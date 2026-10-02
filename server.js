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
