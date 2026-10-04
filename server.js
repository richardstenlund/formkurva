const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS || 30));
const secureCookies = process.env.SECURE_COOKIES === 'true';
const loginWindowMs = 15 * 60 * 1000;
const loginAttempts = new Map();
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'formkurva',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'formkurva',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function initDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash CHAR(128) NOT NULL,
    password_salt CHAR(32) NOT NULL,
    role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    profile_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS measurements (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    data_json TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_measurements_user_date ON measurements (user_id, date)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS workouts (
    id VARCHAR(36) PRIMARY KEY,
    user_id INTEGER NOT NULL,
    date DATE NOT NULL,
    exercise VARCHAR(100) NOT NULL,
    muscle_group VARCHAR(50) NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight DECIMAL(10,2) NOT NULL DEFAULT 0,
    set_details_json TEXT NOT NULL DEFAULT '[]',
    workout_type VARCHAR(20) NOT NULL DEFAULT 'strength',
    cardio_activity VARCHAR(20),
    cardio_location VARCHAR(20),
    distance_km DECIMAL(8,2),
    duration_minutes DECIMAL(8,2),
    incline_percent DECIMAL(5,2),
    notes VARCHAR(500) NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS workout_time TIME');
  await pool.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS set_details_json TEXT NOT NULL DEFAULT '[]'");
  await pool.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS workout_type VARCHAR(20) NOT NULL DEFAULT 'strength'");
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cardio_activity VARCHAR(20)');
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cardio_location VARCHAR(20)');
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS distance_km DECIMAL(8,2)');
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS duration_minutes DECIMAL(8,2)');
  await pool.query('ALTER TABLE workouts ADD COLUMN IF NOT EXISTS incline_percent DECIMAL(5,2)');
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts (user_id, date)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS friendships (
    id SERIAL PRIMARY KEY,
    requester_id INTEGER NOT NULL,
    addressee_id INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (requester_id <> addressee_id)
  )`);
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id))');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id)');
  await pool.query(`CREATE TABLE IF NOT EXISTS cheers (
    id SERIAL PRIMARY KEY,
    from_user INTEGER NOT NULL,
    to_user INTEGER NOT NULL,
    kind VARCHAR(12) NOT NULL,
    cheer_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (from_user, to_user, kind, cheer_date)
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_cheers_to_user ON cheers (to_user, created_at DESC)');
  await pool.query("ALTER TABLE cheers ADD COLUMN IF NOT EXISTS message VARCHAR(140) NOT NULL DEFAULT ''");
  await pool.query(`CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    challenger_id INTEGER NOT NULL,
    opponent_id INTEGER NOT NULL,
    metric VARCHAR(12) NOT NULL,
    days INTEGER NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_challenges_users ON challenges (challenger_id, opponent_id)');
  await pool.query(`CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    code CHAR(8) NOT NULL UNIQUE,
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS group_messages (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    body VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, id DESC)');
  await pool.query(`CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token CHAR(64) NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires ON password_reset_tokens (user_id, expires_at)`);
  await pool.query('DELETE FROM password_reset_tokens WHERE expires_at <= $1', [Date.now()]);

  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (email && password.length >= 8) {
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (rows.length) {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [rows[0].id]);
    } else {
      const { salt, hash } = hashPassword(password);
      await pool.query("INSERT INTO users (email, password_hash, password_salt, role, profile_json) VALUES ($1, $2, $3, 'admin', '{}')", [email, hash, salt]);
    }
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function safeEqual(left, right) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function parseProfile(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}
function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role || 'user', profile: parseProfile(user.profile_json) };
}
async function issuePasswordResetToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 30 * 60 * 1000;
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
  await pool.query('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [userId, token, expiresAt]);
  return token;
}
function getResetLink(req, email, token) {
  const baseUrl = String(process.env.APP_URL || `${req.protocol}://${req.get('host') || 'localhost:3000'}`).replace(/\/$/, '');
  return `${baseUrl}/reset-password.html?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
}
async function sendResetEmail(req, email, token) {
  const host = process.env.SMTP_HOST || '';
  const link = getResetLink(req, email, token);
  if (!host) {
    console.log(`Password reset requested for ${email}. Link: ${link}`);
    return { sent: false, link };
  }
  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'Formkurva <noreply@localhost>',
    to: email,
    subject: 'Återställ ditt lösenord',
    text: `För att återställa ditt lösenord, öppna den här länken: ${link}\n\nLänken är giltig i 30 minuter.`,
    html: `<p>För att återställa ditt lösenord, klicka på länken nedan.</p><p><a href="${link}">${link}</a></p><p>Länken är giltig i 30 minuter.</p>`
  });
  return { sent: true, link };
}
function sessionToken(req) {
  return (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('formkurva_session='))?.split('=')[1];
}
async function sessionUser(req) {
  const token = sessionToken(req);
  if (!token) return null;
  const { rows } = await pool.query(
    'SELECT users.*, sessions.id AS session_id FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = $1 AND sessions.expires_at > $2',
    [token, Date.now()]
  );
  return rows[0] || null;
}
async function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [token, userId, Date.now() + sessionDays * 86400000]);
  res.setHeader('Set-Cookie', `formkurva_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 86400}${secureCookies ? '; Secure' : ''}`);
}
async function requireUser(req, res, next) {
  try {
    req.user = await sessionUser(req);
    if (!req.user) return res.status(401).json({ error: 'Du måste vara inloggad.' });
    next();
  } catch (error) { next(error); }
}
function requireAdmin(req, res, next) { if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administratörsbehörighet krävs.' }); next(); }
function validMeasurement(data) {
  return data && /^\d{4}-\d{2}-\d{2}$/.test(data.date) && ['weight', 'waist', 'chest', 'arm', 'thigh', 'hip']
    .some(key => data[key] !== '' && data[key] !== undefined && Number(data[key]) >= 0);
}

app.use(express.json({ limit: '8mb' }));
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.get('/formkurva.css', (req, res, next) => {
  res.sendFile(path.join(__dirname, 'formkurva.css'), { headers: { 'Cache-Control': 'no-store' } }, error => {
    if (error) next(error);
  });
});
app.get('/fomkurva.css', (req, res) => res.redirect(301, '/formkurva.css'));
app.use(express.static(path.join(__dirname), { index: 'MyHome.html' }));
setInterval(() => pool.query('DELETE FROM sessions WHERE expires_at <= $1', [Date.now()]).catch(console.error), 60 * 60 * 1000).unref();

app.get('/api/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'postgresql' });
  } catch (error) { next(error); }
});
app.get('/api/me', async (req, res, next) => {
  try {
    const user = await sessionUser(req);
    res.json({ user: user ? publicUser(user) : null });
  } catch (error) { next(error); }
});
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Ange en giltig e-post och ett lösenord på minst 8 tecken.' });
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) return res.status(409).json({ error: 'Det finns redan ett konto med den e-posten.' });
    const { salt, hash } = hashPassword(password);
    const result = await pool.query("INSERT INTO users (email, password_hash, password_salt, profile_json) VALUES ($1, $2, $3, '{}') RETURNING id", [email, hash, salt]);
    await createSession(result.rows[0].id, res);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [result.rows[0].id]);
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});
app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const key = (req.ip || 'unknown') + ':' + email;
    const attempt = loginAttempts.get(key) || { count: 0, started: Date.now() };
    if (Date.now() - attempt.started > loginWindowMs) { attempt.count = 0; attempt.started = Date.now(); }
    if (attempt.count >= 8) return res.status(429).json({ error: 'För många försök. Vänta 15 minuter och försök igen.' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !safeEqual(hashPassword(String(req.body.password || ''), user.password_salt).hash, user.password_hash)) {
      attempt.count += 1;
      loginAttempts.set(key, attempt);
      return res.status(401).json({ error: 'E-posten eller lösenordet stämmer inte.' });
    }
    loginAttempts.delete(key);
    await createSession(user.id, res);
    res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});
app.post('/api/auth/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Ange en e-postadress.' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.json({ ok: true, message: 'Om kontot finns får du en återställningslänk i e-posten.' });
    const token = await issuePasswordResetToken(rows[0].id);
    const emailResult = await sendResetEmail(req, email, token);
    const payload = { ok: true, message: emailResult.sent ? 'En återställningslänk har skickats till din e-post.' : 'Ingen SMTP-konfiguration hittades. Använd länken nedan i utvecklingsläge.' };
    if (!emailResult.sent) payload.resetLink = emailResult.link;
    res.json(payload);
  } catch (error) { next(error); }
});
app.post('/api/auth/reset-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const token = String(req.body.token || '').trim();
    const newPassword = String(req.body.newPassword || '');
    if (!email || !token || newPassword.length < 8) return res.status(400).json({ error: 'Ange e-post, återställningskod och ett nytt lösenord med minst 8 tecken.' });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Kontot hittades inte.' });
    const { rows: resetRows } = await pool.query('SELECT * FROM password_reset_tokens WHERE user_id = $1 AND token = $2 AND expires_at > $3 LIMIT 1', [user.id, token, Date.now()]);
    if (!resetRows.length) return res.status(400).json({ error: 'Återställningskoden är ogiltig eller har löpt ut.' });
    const { salt, hash } = hashPassword(newPassword);
    await pool.query('UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3', [hash, salt, user.id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
    res.json({ ok: true, message: 'Lösenordet är återställt. Logga in med det nya lösenordet.' });
  } catch (error) { next(error); }
});
app.post('/api/auth/logout', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM sessions WHERE id = $1', [req.user.session_id]);
    res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/auth/change-password', requireUser, async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || '');
    const nextPassword = String(req.body.newPassword || '');
    if (nextPassword.length < 8) return res.status(400).json({ error: 'Det nya lösenordet måste vara minst 8 tecken.' });
    if (!safeEqual(hashPassword(current, req.user.password_salt).hash, req.user.password_hash)) return res.status(401).json({ error: 'Det nuvarande lösenordet stämmer inte.' });
    const { salt, hash } = hashPassword(nextPassword);
    await pool.query('UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3', [hash, salt, req.user.id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND id != $2', [req.user.id, req.user.session_id]);
    res.json({ ok: true, message: 'Lösenordet är ändrat.' });
  } catch (error) { next(error); }
});
app.get('/api/measurements', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, date, data_json FROM measurements WHERE user_id = $1 ORDER BY date DESC', [req.user.id]);
    res.json({ measurements: rows.map(row => ({ ...parseProfile(row.data_json), id: row.id, date: row.date.toISOString ? row.date.toISOString().slice(0, 10) : String(row.date) })) });
  } catch (error) { next(error); }
});
app.post('/api/measurements', requireUser, async (req, res, next) => {
  try {
    if (!validMeasurement(req.body)) return res.status(400).json({ error: 'Ange datum och minst ett mått.' });
    const id = crypto.randomUUID();
    const { date, ...data } = req.body;
    await pool.query('INSERT INTO measurements (id, user_id, date, data_json) VALUES ($1, $2, $3, $4)', [id, req.user.id, date, JSON.stringify(data)]);
    res.status(201).json({ id, date, ...data });
  } catch (error) { next(error); }
});
app.put('/api/measurements/:id', requireUser, async (req, res, next) => {
  try {
    if (!validMeasurement(req.body)) return res.status(400).json({ error: 'Ange datum och minst ett mått.' });
    const { date, ...data } = req.body;
    const result = await pool.query('UPDATE measurements SET date = $1, data_json = $2 WHERE id = $3 AND user_id = $4 RETURNING id', [date, JSON.stringify(data), req.params.id, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Mätningen hittades inte.' });
    res.json({ id: req.params.id, date, ...data });
  } catch (error) { next(error); }
});
app.delete('/api/measurements/:id', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM measurements WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/workouts', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, date, workout_time, exercise, muscle_group, sets, reps, weight, set_details_json, workout_type, cardio_activity, cardio_location, distance_km, duration_minutes, incline_percent, notes FROM workouts WHERE user_id = $1 ORDER BY date DESC, workout_time DESC NULLS LAST', [req.user.id]);
    res.json({ workouts: rows.map(row => {
      const { set_details_json, ...workout } = row;
      let set_details = [];
      try { set_details = JSON.parse(set_details_json || '[]'); } catch (error) { console.error('Kunde inte läsa set-detaljer för träningspass', row.id, error); }
      return { ...workout, date: row.date.toISOString ? row.date.toISOString().slice(0, 10) : String(row.date), weight: Number(row.weight), set_details };
    }) });
  } catch (error) { next(error); }
});
app.post('/api/workouts', requireUser, async (req, res, next) => {
  try {
    const data = req.body || {};
    const workout_type = data.workout_type === 'cardio' ? 'cardio' : 'strength';
    const cardioActivities = ['walking', 'jogging', 'running'];
    const cardioLocations = ['treadmill', 'outdoor'];
    let cardio = null;
    if (workout_type === 'cardio') {
      const distance = Number(data.distance_km);
      const duration = Number(data.duration_minutes);
      const incline = data.incline_percent === '' || data.incline_percent === undefined ? null : Number(data.incline_percent);
      if (!cardioActivities.includes(data.cardio_activity) || !cardioLocations.includes(data.cardio_location) ||
        !Number.isFinite(distance) || distance <= 0 || distance > 1000 ||
        !Number.isFinite(duration) || duration <= 0 || duration > 1440 ||
        (incline !== null && (!Number.isFinite(incline) || incline < 0 || incline > 40)) ||
        (data.cardio_location === 'outdoor' && incline !== null)) {
        return res.status(400).json({ error: 'Ange aktivitet, plats, distans och tid med giltiga värden. Lutning kan bara anges för löpband (0–40 %).' });
      }
      cardio = { cardio_activity: data.cardio_activity, cardio_location: data.cardio_location, distance_km: distance, duration_minutes: duration, incline_percent: incline };
    }
    const providedSets = data.set_details;
    const fallbackSets = Number(data.sets);
    if (workout_type === 'strength' && providedSets !== undefined && (!Array.isArray(providedSets) || providedSets.length < 1 || providedSets.length > 100 || providedSets.some(set => !set || !Number.isInteger(Number(set.reps)) || Number(set.reps) < 1 || Number(set.reps) > 1000 || !Number.isFinite(Number(set.weight)) || Number(set.weight) < 0 || Number(set.weight) > 10000))) {
      return res.status(400).json({ error: 'Varje set måste ha 1–1000 repetitioner och en giltig vikt.' });
    }
    const set_details = workout_type === 'cardio' ? [] : providedSets
      ? providedSets.map(set => ({ reps: Number(set.reps), weight: Number(set.weight) }))
      : Number.isInteger(fallbackSets) && fallbackSets > 0 && fallbackSets <= 100 && Number.isInteger(Number(data.reps)) && Number(data.reps) > 0 && Number(data.reps) <= 1000 && Number.isFinite(Number(data.weight)) && Number(data.weight) >= 0 && Number(data.weight) <= 10000
        ? Array.from({ length: fallbackSets }, () => ({ reps: Number(data.reps), weight: Number(data.weight) }))
        : [];
    if (!data.date || !data.exercise || (workout_type === 'strength' && !set_details.length) || (data.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))) return res.status(400).json({ error: 'Fyll i giltigt datum, tid, övning och minst ett giltigt set.' });
    const workout = {
      id: crypto.randomUUID(),
      date: String(data.date),
      workout_time: data.time ? `${data.time}:00` : null,
      exercise: String(data.exercise).slice(0, 100),
      muscle_group: String(data.muscleGroup || 'Annat').slice(0, 50),
      sets: cardio ? 0 : set_details.length,
      reps: cardio ? 0 : Math.max(...set_details.map(set => set.reps)),
      weight: cardio ? 0 : Math.max(...set_details.map(set => set.weight)),
      set_details,
      workout_type,
      ...(cardio || {}),
      notes: String(data.notes || '').slice(0, 500)
    };
    await pool.query('INSERT INTO workouts (id, user_id, date, workout_time, exercise, muscle_group, sets, reps, weight, set_details_json, workout_type, cardio_activity, cardio_location, distance_km, duration_minutes, incline_percent, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)', [workout.id, req.user.id, workout.date, workout.workout_time, workout.exercise, workout.muscle_group, workout.sets, workout.reps, workout.weight, JSON.stringify(set_details), workout.workout_type, workout.cardio_activity || null, workout.cardio_location || null, workout.distance_km ?? null, workout.duration_minutes ?? null, workout.incline_percent ?? null, workout.notes]);
    res.status(201).json(workout);
  } catch (error) { next(error); }
});
app.delete('/api/workouts/:id', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM workouts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.put('/api/profile', requireUser, async (req, res, next) => {
  try {
    const profile = { ...req.body };
    delete profile.email;
    if (profile.height !== undefined && profile.height !== '' && (!Number.isFinite(Number(profile.height)) || Number(profile.height) < 50 || Number(profile.height) > 250)) {
      return res.status(400).json({ error: 'Ange en längd mellan 50 och 250 cm.' });
    }
    if (profile.height !== undefined && profile.height !== '') profile.height = Number(profile.height);
    await pool.query('UPDATE users SET profile_json = $1 WHERE id = $2', [JSON.stringify(profile), req.user.id]);
    res.json({ profile });
  } catch (error) { next(error); }
});
const cheerKinds = new Set(['pepp', 'clap', 'fire', 'challenge', 'nudge', 'congrats']);
const nameSql = "COALESCE(NULLIF(TRIM((u.profile_json::jsonb)->>'name'), ''), 'Användare #' || u.id)";
const visibleSql = "COALESCE((u.profile_json::jsonb)->>'communityVisible', 'true') <> 'false'";
const dateOf = row => row.date.toISOString ? row.date.toISOString().slice(0, 10) : String(row.date);
const isoDay = date => date.toISOString().slice(0, 10);
const round1 = value => Math.round(value * 10) / 10;

function weekStart() {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return isoDay(day);
}
function monthStart() {
  const now = new Date();
  return isoDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
}
function rowVolume(row) {
  let sets = [];
  try { sets = JSON.parse(row.set_details_json || '[]'); } catch { sets = []; }
  if (Array.isArray(sets) && sets.length) return sets.reduce((total, set) => total + (Number(set.reps) || 0) * (Number(set.weight) || 0), 0);
  return (Number(row.sets) || 0) * (Number(row.reps) || 0) * (Number(row.weight) || 0);
}
function summarize(rows, since = '') {
  const list = since ? rows.filter(row => dateOf(row) >= since) : rows;
  let cardioKm = 0;
  let volume = 0;
  list.forEach(row => {
    if (row.workout_type === 'cardio') cardioKm += Number(row.distance_km) || 0;
    else volume += rowVolume(row);
  });
  return { workouts: list.length, days: new Set(list.map(dateOf)).size, cardioKm: round1(cardioKm), volume: Math.round(volume) };
}
function currentStreak(rows) {
  const days = new Set(rows.map(dateOf));
  const cursor = new Date();
  if (!days.has(isoDay(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(isoDay(cursor))) { streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
}
function computeBadges(rows) {
  const days = new Set(rows.map(dateOf));
  const slots = { morning: new Set(), day: new Set(), evening: new Set() };
  const exerciseCounts = new Map();
  const cardio = { walking: 0, jogging: 0, running: 0 };
  const km = { treadmill: 0, outdoor: 0 };
  rows.forEach(row => {
    const hour = Number(String(row.workout_time || '').slice(0, 2));
    if (hour >= 5 && hour < 9) slots.morning.add(dateOf(row));
    else if (hour >= 9 && hour < 17) slots.day.add(dateOf(row));
    else if (hour >= 17 && hour < 23) slots.evening.add(dateOf(row));
    if (row.workout_type === 'cardio') {
      if (row.cardio_activity in cardio) cardio[row.cardio_activity] += 1;
      if (row.cardio_location in km) km[row.cardio_location] += Number(row.distance_km) || 0;
    } else {
      const key = String(row.exercise).trim().toLowerCase();
      const entry = exerciseCounts.get(key) || { name: String(row.exercise).trim(), count: 0 };
      entry.count += 1;
      exerciseCounts.set(key, entry);
    }
  });
  const topExercises = [...exerciseCounts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  const items = [
    ['Träningspass totalt', 'pass', rows.length, [10, 50, 100]],
    ['Aktiva träningsdagar', 'dagar', days.size, [3, 10, 25]],
    ['Morgontränare', 'dagar kl. 05–09', slots.morning.size, [1, 5, 20]],
    ['Dagsform', 'dagar kl. 09–17', slots.day.size, [1, 5, 20]],
    ['Kvällskämpe', 'dagar kl. 17–23', slots.evening.size, [1, 5, 20]],
    ['Gång', 'pass', cardio.walking, [1, 5, 20]],
    ['Jogging', 'pass', cardio.jogging, [1, 5, 20]],
    ['Löpning', 'pass', cardio.running, [1, 5, 20]],
    ['Löpband · distans', 'km', round1(km.treadmill), [10, 50, 100]],
    ['Utomhus · distans', 'km', round1(km.outdoor), [10, 50, 100]],
    ...topExercises.map(item => [item.name, 'pass', item.count, [1, 5, 10]])
  ];
  return items
    .map(([title, unit, count, thresholds]) => {
      const tier = thresholds.filter(threshold => count >= threshold).length;
      return { title, unit, count, tier, next: thresholds[tier] ?? null };
    })
    .filter(badge => badge.tier > 0)
    .sort((a, b) => b.tier - a.tier);
}
async function loadWorkoutRows(userIds) {
  const grouped = new Map(userIds.map(id => [id, []]));
  if (!userIds.length) return grouped;
  const { rows } = await pool.query('SELECT user_id, date, workout_time, exercise, sets, reps, weight, set_details_json, workout_type, cardio_activity, cardio_location, distance_km, duration_minutes FROM workouts WHERE user_id = ANY($1::int[]) ORDER BY date DESC, workout_time DESC NULLS LAST', [userIds]);
  rows.forEach(row => grouped.get(row.user_id)?.push(row));
  return grouped;
}
async function relationshipsFor(userId) {
  const { rows } = await pool.query('SELECT id, status, requester_id, addressee_id FROM friendships WHERE requester_id = $1 OR addressee_id = $1', [userId]);
  const map = new Map();
  rows.forEach(row => {
    const otherId = row.requester_id === userId ? row.addressee_id : row.requester_id;
    map.set(otherId, { id: row.id, status: row.status, direction: row.requester_id === userId ? 'outgoing' : 'incoming' });
  });
  return map;
}
async function acceptedFriendIds(userId) {
  const relations = await relationshipsFor(userId);
  return [...relations.entries()].filter(([, relation]) => relation.status === 'accepted').map(([id]) => id);
}

app.get('/api/friends', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.status, f.requester_id, u.id AS other_id, ${nameSql} AS name
       FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1 ORDER BY f.created_at DESC`, [req.user.id]);
    const result = { friends: [], incoming: [], outgoing: [] };
    rows.forEach(row => {
      const item = { id: row.id, userId: row.other_id, name: row.name };
      if (row.status === 'accepted') result.friends.push(item);
      else if (row.requester_id === req.user.id) result.outgoing.push(item);
      else result.incoming.push(item);
    });
    res.json(result);
  } catch (error) { next(error); }
});
app.post('/api/friends', requireUser, async (req, res, next) => {
  try {
    const message = 'Om användaren finns har en vänförfrågan skickats.';
    let target;
    if (req.body?.userId !== undefined) {
      const { rows } = await pool.query(`SELECT u.id FROM users u WHERE u.id = $1 AND ${visibleSql}`, [Number(req.body.userId) || 0]);
      target = rows[0];
    } else {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email || email.length > 254) return res.status(400).json({ error: 'Ange en e-postadress.' });
      const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      target = rows[0];
    }
    if (!target || target.id === req.user.id) return res.status(202).json({ message });
    const existing = (await relationshipsFor(req.user.id)).get(target.id);
    if (existing && existing.status === 'pending' && existing.direction === 'incoming') {
      await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1", [existing.id]);
      return res.status(202).json({ message: 'Ni är nu vänner.' });
    }
    if (!existing) await pool.query('INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2)', [req.user.id, target.id]);
    res.status(202).json({ message });
  } catch (error) { next(error); }
});
app.post('/api/friends/:id/accept', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = $1 AND addressee_id = $2 AND status = 'pending'", [Number(req.params.id) || 0, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Vänförfrågan hittades inte.' });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.delete('/api/friends/:id', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM friendships WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)', [Number(req.params.id) || 0, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/community', requireUser, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase().slice(0, 50).replace(/[%_\\]/g, '\\$&');
    const { rows: users } = await pool.query(
      `SELECT u.id, ${nameSql} AS name FROM users u
       WHERE u.id <> $1 AND ${visibleSql} AND ($2 = '' OR LOWER(${nameSql}) LIKE '%' || $2 || '%')
       ORDER BY name LIMIT 50`, [req.user.id, q]);
    const [grouped, relations] = await Promise.all([loadWorkoutRows(users.map(user => user.id)), relationshipsFor(req.user.id)]);
    const since = weekStart();
    res.json({ users: users.map(user => {
      const workouts = grouped.get(user.id) || [];
      const relation = relations.get(user.id);
      return {
        id: user.id,
        name: user.name,
        totalWorkouts: workouts.length,
        weekWorkouts: summarize(workouts, since).workouts,
        streak: currentStreak(workouts),
        relation: relation ? { id: relation.id, status: relation.status, direction: relation.direction } : null
      };
    }) });
  } catch (error) { next(error); }
});
app.get('/api/people/:id', requireUser, async (req, res, next) => {
  try {
    const personId = Number(req.params.id) || 0;
    const { rows: [person] } = await pool.query(`SELECT u.id, ${nameSql} AS name, ${visibleSql} AS visible FROM users u WHERE u.id = $1`, [personId]);
    if (!person) return res.status(404).json({ error: 'Användaren hittades inte.' });
    const relation = (await relationshipsFor(req.user.id)).get(personId);
    const isSelf = personId === req.user.id;
    const isFriend = isSelf || relation?.status === 'accepted';
    if (!isFriend && !person.visible) return res.status(404).json({ error: 'Användaren hittades inte.' });
    const rows = (await loadWorkoutRows([personId])).get(personId) || [];
    const month = summarize(rows, monthStart());
    const week = summarize(rows, weekStart());
    const all = summarize(rows);
    const result = {
      id: personId,
      name: person.name,
      level: isFriend ? 'friend' : 'public',
      isSelf,
      relation: relation ? { id: relation.id, status: relation.status, direction: relation.direction } : null,
      stats: { total: all.workouts, days: all.days, cardioKm: all.cardioKm, volume: all.volume, week: week.workouts, month: month.workouts, streak: currentStreak(rows) },
      badges: computeBadges(rows)
    };
    if (isFriend) {
      const records = new Map();
      rows.filter(row => row.workout_type !== 'cardio').forEach(row => {
        const key = row.exercise.toLowerCase();
        const weight = Number(row.weight);
        if (!records.has(key) || weight > records.get(key).weight) records.set(key, { exercise: row.exercise, weight, reps: row.reps });
      });
      result.records = [...records.values()].sort((a, b) => b.weight - a.weight).slice(0, 8);
      result.recent = rows.slice(0, 5).map(row => row.workout_type === 'cardio'
        ? { date: dateOf(row), exercise: row.exercise, detail: `${Number(row.distance_km)} km på ${Number(row.duration_minutes)} min` }
        : { date: dateOf(row), exercise: row.exercise, detail: `${row.sets} × ${row.reps} @ ${Number(row.weight)} kg` });
      if (!isSelf) {
        const { rows: sent } = await pool.query('SELECT kind FROM cheers WHERE from_user = $1 AND to_user = $2 AND cheer_date = CURRENT_DATE', [req.user.id, personId]);
        result.cheeredToday = sent.map(row => row.kind);
        result.compare = { me: { ...summarize((await loadWorkoutRows([req.user.id])).get(req.user.id) || [], weekStart()) }, them: week };
      }
    }
    res.json(result);
  } catch (error) { next(error); }
});
app.post('/api/cheers', requireUser, async (req, res, next) => {
  try {
    const toUserId = Number(req.body?.toUserId) || 0;
    const kind = String(req.body?.kind || '');
    const message = String(req.body?.message || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!cheerKinds.has(kind) || toUserId === req.user.id) return res.status(400).json({ error: 'Ogiltig hälsning.' });
    if (!(await acceptedFriendIds(req.user.id)).includes(toUserId)) return res.status(403).json({ error: 'Du kan bara skicka hälsningar till vänner.' });
    const result = await pool.query('INSERT INTO cheers (from_user, to_user, kind, message) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [req.user.id, toUserId, kind, message]);
    if (!result.rowCount) return res.status(409).json({ error: 'Du har redan skickat den hälsningen idag.' });
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
app.get('/api/cheers', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.kind, c.message, c.created_at, ${nameSql} AS name, c.from_user FROM cheers c JOIN users u ON u.id = c.from_user
       WHERE c.to_user = $1 ORDER BY c.created_at DESC LIMIT 15`, [req.user.id]);
    const { rows: [counts] } = await pool.query('SELECT COUNT(*) FILTER (WHERE from_user = $1) AS sent, COUNT(*) FILTER (WHERE to_user = $1) AS received FROM cheers WHERE from_user = $1 OR to_user = $1', [req.user.id]);
    const friends = (await acceptedFriendIds(req.user.id)).length;
    res.json({ stats: { sent: Number(counts.sent), received: Number(counts.received), friends }, cheers: rows.map(row => ({ kind: row.kind, message: row.message, name: row.name, fromUserId: row.from_user, createdAt: row.created_at })) });
  } catch (error) { next(error); }
});
app.get('/api/leaderboard', requireUser, async (req, res, next) => {
  try {
    const period = req.query.period === 'month' ? 'month' : 'week';
    const since = period === 'month' ? monthStart() : weekStart();
    const ids = [req.user.id, ...await acceptedFriendIds(req.user.id)];
    const [{ rows: users }, grouped] = await Promise.all([
      pool.query(`SELECT u.id, ${nameSql} AS name FROM users u WHERE u.id = ANY($1::int[])`, [ids]),
      loadWorkoutRows(ids)
    ]);
    res.json({ period, since, entries: users.map(user => {
      const rows = grouped.get(user.id) || [];
      return { userId: user.id, name: user.name, isMe: user.id === req.user.id, ...summarize(rows, since), streak: currentStreak(rows), lastWorkout: rows.length ? dateOf(rows[0]) : null };
    }) });
  } catch (error) { next(error); }
});
app.get('/api/records', requireUser, async (req, res, next) => {
  try {
    const ids = [req.user.id, ...await acceptedFriendIds(req.user.id)];
    const [{ rows: users }, grouped] = await Promise.all([
      pool.query(`SELECT u.id, ${nameSql} AS name FROM users u WHERE u.id = ANY($1::int[])`, [ids]),
      loadWorkoutRows(ids)
    ]);
    const exercises = new Map();
    users.forEach(user => {
      const best = new Map();
      (grouped.get(user.id) || []).filter(row => row.workout_type !== 'cardio').forEach(row => {
        const key = String(row.exercise).trim().toLowerCase();
        const weight = Number(row.weight);
        if (!best.has(key) || weight > best.get(key).weight) best.set(key, { exercise: String(row.exercise).trim(), weight, reps: row.reps });
      });
      best.forEach((record, key) => {
        if (!exercises.has(key)) exercises.set(key, { exercise: record.exercise, entries: [] });
        exercises.get(key).entries.push({ userId: user.id, name: user.name, isMe: user.id === req.user.id, weight: record.weight, reps: record.reps });
      });
    });
    const list = [...exercises.values()]
      .map(item => ({ ...item, entries: item.entries.sort((a, b) => b.weight - a.weight) }))
      .sort((a, b) => b.entries.length - a.entries.length || a.exercise.localeCompare(b.exercise, 'sv'))
      .slice(0, 30);
    res.json({ exercises: list });
  } catch (error) { next(error); }
});
app.get('/api/activity', requireUser, async (req, res, next) => {
  try {
    const ids = [req.user.id, ...await acceptedFriendIds(req.user.id)];
    const { rows } = await pool.query(
      `SELECT c.kind, c.message, c.created_at, c.from_user, c.to_user, ${nameSql} AS from_name,
              COALESCE(NULLIF(TRIM((t.profile_json::jsonb)->>'name'), ''), 'Användare #' || t.id) AS to_name
       FROM cheers c JOIN users u ON u.id = c.from_user JOIN users t ON t.id = c.to_user
       WHERE c.from_user = ANY($1::int[]) AND c.to_user = ANY($1::int[])
       ORDER BY c.created_at DESC LIMIT 30`, [ids]);
    res.json({ items: rows.map(row => ({
      kind: row.kind, message: row.message, createdAt: row.created_at,
      fromUserId: row.from_user, fromName: row.from_name, toUserId: row.to_user, toName: row.to_name,
      fromMe: row.from_user === req.user.id, toMe: row.to_user === req.user.id
    })) });
  } catch (error) { next(error); }
});
const challengeMetrics = new Set(['workouts', 'days', 'cardioKm', 'volume']);
function challengeScore(rows, from, to, metric) {
  return summarize(rows.filter(row => dateOf(row) >= from && dateOf(row) <= to))[metric];
}
app.get('/api/challenges', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT ch.id, ch.metric, ch.days, ch.status, ch.start_date, ch.end_date, ch.challenger_id, ch.opponent_id,
              ${nameSql} AS other_name, u.id AS other_id
       FROM challenges ch JOIN users u ON u.id = CASE WHEN ch.challenger_id = $1 THEN ch.opponent_id ELSE ch.challenger_id END
       WHERE ch.challenger_id = $1 OR ch.opponent_id = $1 ORDER BY ch.created_at DESC LIMIT 30`, [req.user.id]);
    const ids = [...new Set([req.user.id, ...rows.map(row => row.other_id)])];
    const grouped = await loadWorkoutRows(ids);
    const today = isoDay(new Date());
    res.json({ challenges: rows.map(row => {
      const item = { id: row.id, metric: row.metric, days: row.days, status: row.status, otherId: row.other_id, otherName: row.other_name, incoming: row.opponent_id === req.user.id };
      if (row.status === 'active') {
        const from = dateOf({ date: row.start_date });
        const to = dateOf({ date: row.end_date });
        item.startDate = from; item.endDate = to;
        item.me = challengeScore(grouped.get(req.user.id) || [], from, to, row.metric);
        item.them = challengeScore(grouped.get(row.other_id) || [], from, to, row.metric);
        item.finished = to < today;
        item.result = !item.finished ? 'ongoing' : item.me > item.them ? 'won' : item.me < item.them ? 'lost' : 'draw';
      }
      return item;
    }) });
  } catch (error) { next(error); }
});
app.post('/api/challenges', requireUser, async (req, res, next) => {
  try {
    const opponentId = Number(req.body?.userId) || 0;
    const metric = String(req.body?.metric || '');
    const days = [3, 7, 14, 30].includes(Number(req.body?.days)) ? Number(req.body.days) : 0;
    if (!challengeMetrics.has(metric) || !days) return res.status(400).json({ error: 'Välj mått och längd för utmaningen.' });
    if (!(await acceptedFriendIds(req.user.id)).includes(opponentId)) return res.status(403).json({ error: 'Du kan bara utmana vänner.' });
    const { rows: [open] } = await pool.query("SELECT COUNT(*) FROM challenges WHERE (challenger_id = $1 OR opponent_id = $1) AND (status = 'pending' OR (status = 'active' AND end_date >= CURRENT_DATE))", [req.user.id]);
    if (Number(open.count) >= 10) return res.status(409).json({ error: 'Du har redan 10 pågående utmaningar.' });
    await pool.query('INSERT INTO challenges (challenger_id, opponent_id, metric, days) VALUES ($1, $2, $3, $4)', [req.user.id, opponentId, metric, days]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
app.post('/api/challenges/:id/accept', requireUser, async (req, res, next) => {
  try {
    const result = await pool.query("UPDATE challenges SET status = 'active', start_date = CURRENT_DATE, end_date = CURRENT_DATE + (days - 1) WHERE id = $1 AND opponent_id = $2 AND status = 'pending'", [Number(req.params.id) || 0, req.user.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Utmaningen hittades inte.' });
    res.status(204).end();
  } catch (error) { next(error); }
});
app.delete('/api/challenges/:id', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM challenges WHERE id = $1 AND (challenger_id = $2 OR opponent_id = $2)', [Number(req.params.id) || 0, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
async function groupSummary(group, userId) {
  const { rows: members } = await pool.query(`SELECT u.id, ${nameSql} AS name FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1`, [group.id]);
  const grouped = await loadWorkoutRows(members.map(member => member.id));
  const since = weekStart();
  return {
    id: group.id, name: group.name, isOwner: group.owner_id === userId,
    code: group.owner_id === userId ? group.code.trim() : undefined,
    members: members.map(member => {
      const rows = grouped.get(member.id) || [];
      return { userId: member.id, name: member.name, isMe: member.id === userId, ...summarize(rows, since), streak: currentStreak(rows) };
    }).sort((a, b) => b.workouts - a.workouts || b.days - a.days || a.name.localeCompare(b.name, 'sv'))
  };
}
app.get('/api/groups', requireUser, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT g.* FROM groups g JOIN group_members gm ON gm.group_id = g.id WHERE gm.user_id = $1 ORDER BY g.created_at', [req.user.id]);
    res.json({ groups: await Promise.all(rows.map(group => groupSummary(group, req.user.id))) });
  } catch (error) { next(error); }
});
app.post('/api/groups', requireUser, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Ange ett namn på gruppen.' });
    const { rows: [count] } = await pool.query('SELECT COUNT(*) FROM group_members WHERE user_id = $1', [req.user.id]);
    if (Number(count.count) >= 10) return res.status(409).json({ error: 'Du kan max vara med i 10 grupper.' });
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const { rows: [group] } = await pool.query('INSERT INTO groups (name, code, owner_id) VALUES ($1, $2, $3) RETURNING id', [name, code, req.user.id]);
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group.id, req.user.id]);
    res.status(201).json({ id: group.id, code });
  } catch (error) { next(error); }
});
app.post('/api/groups/join', requireUser, async (req, res, next) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const { rows: [group] } = /^[0-9A-F]{8}$/.test(code) ? await pool.query('SELECT * FROM groups WHERE code = $1', [code]) : { rows: [] };
    if (!group) return res.status(404).json({ error: 'Ingen grupp hittades med den koden.' });
    const { rows: [size] } = await pool.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [group.id]);
    const { rows: [mine] } = await pool.query('SELECT COUNT(*) FROM group_members WHERE user_id = $1', [req.user.id]);
    if (Number(size.count) >= 20) return res.status(409).json({ error: 'Gruppen är full (max 20 medlemmar).' });
    if (Number(mine.count) >= 10) return res.status(409).json({ error: 'Du kan max vara med i 10 grupper.' });
    await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group.id, req.user.id]);
    res.status(201).json({ name: group.name });
  } catch (error) { next(error); }
});
app.delete('/api/groups/:id', requireUser, async (req, res, next) => {
  try {
    const id = Number(req.params.id) || 0;
    const { rows: [group] } = await pool.query('SELECT owner_id FROM groups WHERE id = $1', [id]);
    if (group?.owner_id === req.user.id) await pool.query('DELETE FROM groups WHERE id = $1', [id]);
    else await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/pr-feed', requireUser, async (req, res, next) => {
  try {
    const ids = [req.user.id, ...await acceptedFriendIds(req.user.id)];
    const [{ rows: users }, grouped] = await Promise.all([
      pool.query(`SELECT u.id, ${nameSql} AS name FROM users u WHERE u.id = ANY($1::int[])`, [ids]),
      loadWorkoutRows(ids)
    ]);
    const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 14);
    const since = isoDay(cutoff);
    const items = [];
    users.forEach(user => {
      const best = new Map();
      [...(grouped.get(user.id) || [])].filter(row => row.workout_type !== 'cardio').reverse().forEach(row => {
        const key = String(row.exercise).trim().toLowerCase();
        const weight = Number(row.weight);
        const previous = best.get(key);
        if (previous !== undefined && weight > previous && dateOf(row) >= since) items.push({ userId: user.id, name: user.name, isMe: user.id === req.user.id, exercise: String(row.exercise).trim(), weight, previous, date: dateOf(row) });
        if (previous === undefined || weight > previous) best.set(key, weight);
      });
    });
    res.json({ items: items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20) });
  } catch (error) { next(error); }
});
async function requireGroupMember(req, res) {
  const id = Number(req.params.id) || 0;
  const { rows } = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [id, req.user.id]);
  if (!rows.length) { res.status(404).json({ error: 'Gruppen hittades inte.' }); return 0; }
  return id;
}
app.get('/api/groups/:id/messages', requireUser, async (req, res, next) => {
  try {
    const id = await requireGroupMember(req, res);
    if (!id) return;
    const { rows } = await pool.query(
      `SELECT * FROM (SELECT m.id, m.body, m.created_at, m.user_id, ${nameSql} AS name FROM group_messages m JOIN users u ON u.id = m.user_id WHERE m.group_id = $1 ORDER BY m.id DESC LIMIT 50) recent ORDER BY id`, [id]);
    res.json({ messages: rows.map(row => ({ id: row.id, body: row.body, createdAt: row.created_at, userId: row.user_id, name: row.name, isMe: row.user_id === req.user.id })) });
  } catch (error) { next(error); }
});
app.post('/api/groups/:id/messages', requireUser, async (req, res, next) => {
  try {
    const id = await requireGroupMember(req, res);
    if (!id) return;
    const body = String(req.body?.body || '').replace(/[ \t]+/g, ' ').trim().slice(0, 500);
    if (!body) return res.status(400).json({ error: 'Skriv ett meddelande.' });
    const { rows: [recent] } = await pool.query("SELECT COUNT(*) FROM group_messages WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'", [req.user.id]);
    if (Number(recent.count) >= 20) return res.status(429).json({ error: 'Du skickar för snabbt. Vänta en stund.' });
    await pool.query('INSERT INTO group_messages (group_id, user_id, body) VALUES ($1, $2, $3)', [id, req.user.id, body]);
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});
function seasonPoints(rows, from, to) {
  const list = rows.filter(row => dateOf(row) >= from && dateOf(row) <= to);
  const sum = summarize(list);
  const points = sum.workouts * 10 + sum.days * 5 + Math.round(sum.cardioKm * 2) + Math.floor(sum.volume / 1000);
  return { points, ...sum };
}
function monthRange(offset) {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset + 1, 0));
  return { from: isoDay(first), to: isoDay(last), label: first.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}
app.get('/api/season', requireUser, async (req, res, next) => {
  try {
    const ids = [req.user.id, ...await acceptedFriendIds(req.user.id)];
    const [{ rows: users }, grouped] = await Promise.all([
      pool.query(`SELECT u.id, ${nameSql} AS name FROM users u WHERE u.id = ANY($1::int[])`, [ids]),
      loadWorkoutRows(ids)
    ]);
    const build = range => users.map(user => ({ userId: user.id, name: user.name, isMe: user.id === req.user.id, ...seasonPoints(grouped.get(user.id) || [], range.from, range.to) }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'sv'));
    const now = new Date();
    const earliest = [...grouped.values()].flat().reduce((min, row) => dateOf(row) < min ? dateOf(row) : min, isoDay(now)).slice(0, 7);
    const months = [];
    for (let offset = 0; offset > -36; offset -= 1) {
      const range = monthRange(offset);
      if (range.from.slice(0, 7) < earliest) break;
      const entries = build(range);
      months.push({ month: range.from.slice(0, 7), label: range.label, current: offset === 0, winner: entries[0]?.points > 0 ? entries[0] : null, mine: entries.find(entry => entry.isMe), entries });
    }
    const requested = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : months[0].month;
    const selected = months.find(month => month.month === requested) || months[0];
    const daysLeft = Math.max(0, Math.round((Date.parse(monthRange(0).to) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 86400000));
    res.json({
      selected: { month: selected.month, label: selected.label, current: selected.current, daysLeft: selected.current ? daysLeft : 0, entries: selected.entries },
      months: months.map(month => ({ month: month.month, label: month.label, current: month.current, winner: month.winner ? { name: month.winner.name, isMe: month.winner.isMe, points: month.winner.points } : null, myPoints: month.mine?.points || 0 }))
    });
  } catch (error) { next(error); }
});app.get('/api/notifications', requireUser, async (req, res, next) => {
  try {
    const me = req.user.id;
    const items = [];
    const [cheers, requests, challenges] = await Promise.all([
      pool.query(`SELECT c.id, c.kind, c.message, c.created_at, ${nameSql} AS name FROM cheers c JOIN users u ON u.id = c.from_user WHERE c.to_user = $1 ORDER BY c.id DESC LIMIT 10`, [me]),
      pool.query(`SELECT f.id, ${nameSql} AS name FROM friendships f JOIN users u ON u.id = f.requester_id WHERE f.addressee_id = $1 AND f.status = 'pending'`, [me]),
      pool.query(`SELECT ch.id, ${nameSql} AS name FROM challenges ch JOIN users u ON u.id = ch.challenger_id WHERE ch.opponent_id = $1 AND ch.status = 'pending'`, [me])
    ]);
    cheers.rows.forEach(row => items.push({ key: `cheer:${row.id}`, kind: 'cheer', cheerKind: row.kind, text: `${row.name} skickade en hälsning${row.message ? `: ”${row.message}”` : ''}` }));
    requests.rows.forEach(row => items.push({ key: `friend:${row.id}`, kind: 'friend', text: `${row.name} vill bli din vän` }));
    challenges.rows.forEach(row => items.push({ key: `challenge:${row.id}`, kind: 'challenge', text: `${row.name} har utmanat dig` }));
    const friendIds = await acceptedFriendIds(me);
    if (friendIds.length) {
      const [{ rows: users }, grouped] = await Promise.all([
        pool.query(`SELECT u.id, ${nameSql} AS name FROM users u WHERE u.id = ANY($1::int[])`, [friendIds]),
        loadWorkoutRows(friendIds)
      ]);
      const cutoff = new Date(); cutoff.setUTCDate(cutoff.getUTCDate() - 3);
      const since = isoDay(cutoff);
      users.forEach(user => {
        const best = new Map();
        [...(grouped.get(user.id) || [])].filter(row => row.workout_type !== 'cardio').reverse().forEach(row => {
          const key = String(row.exercise).trim().toLowerCase();
          const weight = Number(row.weight);
          const previous = best.get(key);
          if (previous !== undefined && weight > previous && dateOf(row) >= since) items.push({ key: `pr:${user.id}:${key}:${weight}`, kind: 'pr', text: `${user.name} slog personbästa i ${String(row.exercise).trim()}: ${weight} kg` });
          if (previous === undefined || weight > previous) best.set(key, weight);
        });
      });
    }
    const { rows: [msg] } = await pool.query(
      `SELECT g.name, COUNT(*) AS count, MAX(m.id) AS last_id FROM group_messages m JOIN groups g ON g.id = m.group_id
       WHERE m.user_id <> $1 AND m.group_id IN (SELECT group_id FROM group_members WHERE user_id = $1) AND m.created_at > NOW() - INTERVAL '1 day' GROUP BY g.name ORDER BY MAX(m.id) DESC LIMIT 1`, [me]);
    if (msg) items.push({ key: `chat:${msg.last_id}`, kind: 'chat', text: `Nytt meddelande i gruppen ${msg.name}` });
    res.json({ items });
  } catch (error) { next(error); }
});
app.get('/api/feed', requireUser, async (req, res, next) => {
  try {
    const ids = await acceptedFriendIds(req.user.id);
    if (!ids.length) return res.json({ items: [] });
    const { rows } = await pool.query(
      `SELECT w.user_id, ${nameSql} AS name, w.date, w.exercise, w.sets, w.reps, w.weight, w.workout_type, w.distance_km, w.duration_minutes
       FROM workouts w JOIN users u ON u.id = w.user_id WHERE w.user_id = ANY($1::int[])
       ORDER BY w.date DESC, w.workout_time DESC NULLS LAST LIMIT 15`, [ids]);
    res.json({ items: rows.map(row => ({
      userId: row.user_id,
      name: row.name,
      date: dateOf(row),
      exercise: row.exercise,
      detail: row.workout_type === 'cardio' ? `${Number(row.distance_km)} km på ${Number(row.duration_minutes)} min` : `${row.sets} × ${row.reps} @ ${Number(row.weight)} kg`
    })) });
  } catch (error) { next(error); }
});
app.delete('/api/account', requireUser, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.status(204).end();
  } catch (error) { next(error); }
});
app.get('/api/admin/stats', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const { rows: [users] } = await pool.query('SELECT COUNT(*) AS count FROM users');
    const { rows: [admins] } = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
    const { rows: [measurements] } = await pool.query('SELECT COUNT(*) AS count FROM measurements');
    res.json({ users: Number(users.count), admins: Number(admins.count), measurements: Number(measurements.count) });
  } catch (error) { next(error); }
});
app.get('/api/admin/users', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT users.id, users.email, users.role, users.created_at, COUNT(measurements.id) AS measurement_count FROM users LEFT JOIN measurements ON measurements.user_id = users.id GROUP BY users.id ORDER BY users.created_at ASC');
    res.json({ users: rows });
  } catch (error) { next(error); }
});
app.post('/api/admin/users', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const role = req.body.role === 'admin' ? 'admin' : 'user';
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Ange en giltig e-post och ett lösenord med minst 8 tecken.' });
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.length) return res.status(409).json({ error: 'Det finns redan ett konto med den e-posten.' });
    const { salt, hash } = hashPassword(password);
    const result = await pool.query("INSERT INTO users (email, password_hash, password_salt, role, profile_json) VALUES ($1, $2, $3, $4, '{}') RETURNING id", [email, hash, salt, role]);
    res.status(201).json({ id: result.rows[0].id, email, role });
  } catch (error) { next(error); }
});
app.post('/api/admin/users/:id/password', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const newPassword = String(req.body.newPassword || '');
    if (!Number.isInteger(userId) || newPassword.length < 8) return res.status(400).json({ error: 'Välj en användare och ange ett nytt lösenord med minst 8 tecken.' });
    const { rows: [target] } = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (!target) return res.status(404).json({ error: 'Kontot hittades inte.' });
    const { salt, hash } = hashPassword(newPassword);
    await pool.query('UPDATE users SET password_hash = $1, password_salt = $2 WHERE id = $3', [hash, salt, userId]);
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    res.json({ ok: true, message: 'Lösenordet har ändrats för användaren.' });
  } catch (error) { next(error); }
});
app.patch('/api/admin/users/:id/role', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const role = req.body.role === 'admin' ? 'admin' : req.body.role === 'user' ? 'user' : '';
    const userId = Number(req.params.id);
    if (!role || !Number.isInteger(userId)) return res.status(400).json({ error: 'Ogiltig roll.' });
    if (userId === req.user.id && role !== 'admin') return res.status(400).json({ error: 'Du kan inte ta bort adminrollen från dig själv.' });
    const { rows: [target] } = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [userId]);
    if (!target) return res.status(404).json({ error: 'Kontot hittades inte.' });
    if (target.role === 'admin' && role === 'user') {
      const { rows: [count] } = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (Number(count.count) <= 1) return res.status(400).json({ error: 'Det måste alltid finnas minst en administratör.' });
    }
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    res.json({ id: target.id, email: target.email, role });
  } catch (error) { next(error); }
});
app.delete('/api/admin/users/:id', requireUser, requireAdmin, async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    if (userId === req.user.id) return res.status(400).json({ error: 'Du kan inte radera ditt eget admin-konto här.' });
    const { rows: [target] } = await pool.query('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (!target) return res.status(404).json({ error: 'Kontot hittades inte.' });
    if (target.role === 'admin') {
      const { rows: [count] } = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (Number(count.count) <= 1) return res.status(400).json({ error: 'Det måste alltid finnas minst en administratör.' });
    }
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.post('/api/admin/users/:id/logout', requireUser, requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [Number(req.params.id)]);
    res.status(204).end();
  } catch (error) { next(error); }
});
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Ett oväntat serverfel uppstod.' });
});

initDatabase().then(() => app.listen(port, () => console.log(`Formkurva kör på http://localhost:${port}`))).catch(error => {
  console.error('Databasen kunde inte startas:', error);
  process.exit(1);
});
