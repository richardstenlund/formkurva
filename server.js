const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS || 30));
const secureCookies = process.env.SECURE_COOKIES === 'true';
const loginWindowMs = 15 * 60 * 1000;
const loginAttempts = new Map();
const db = new Database(process.env.DB_PATH || '/data/formkurva.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    profile_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS measurements (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    data_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    exercise TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    sets INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight REAL NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS routines (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    routine_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS measurements_user_date_idx ON measurements(user_id, date);
  CREATE INDEX IF NOT EXISTS workouts_user_date_idx ON workouts(user_id, date);
`);
try { db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'"); } catch (error) { if (!error.message.includes('duplicate column name')) throw error; }

function ensureBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || password.length < 8) return;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) { db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(existing.id); return; }
  const { salt, hash } = hashPassword(password);
  db.prepare("INSERT INTO users (email, password_hash, password_salt, role) VALUES (?, ?, ?, 'admin')").run(email, hash, salt);
}
ensureBootstrapAdmin();

app.use(express.json({ limit: '8mb' }));
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); next(); });
app.use(express.static(path.join(__dirname), { index: 'MyHome.html' }));
setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()), 60 * 60 * 1000).unref();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function safeEqual(left, right) {
  const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function createSession(userId, res) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + sessionDays * 86400000;
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  res.cookieHeader = `formkurva_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionDays * 86400}${secureCookies ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', res.cookieHeader);
}
function sessionUser(req) {
  const cookies = req.headers.cookie || '';
  const token = cookies.split(';').map(item => item.trim()).find(item => item.startsWith('formkurva_session='))?.split('=')[1];
  if (!token) return null;
  const row = db.prepare('SELECT users.*, sessions.id AS session_id FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ? AND sessions.expires_at > ?').get(token, Date.now());
  return row || null;
}
function requireUser(req, res, next) {
  const user = sessionUser(req);
  if (!user) return res.status(401).json({ error: 'Du måste vara inloggad.' });
  req.user = user; next();
}
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Administratörsbehörighet krävs.' });
  next();
}
function publicUser(user) { return { id: user.id, email: user.email, role: user.role || 'user', profile: JSON.parse(user.profile_json || '{}') }; }
function validMeasurement(data) {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return false;
  return ['weight', 'waist', 'chest', 'arm', 'thigh', 'hip'].some(key => data[key] !== '' && data[key] !== undefined && Number(data[key]) >= 0);
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/me', (req, res) => { const user = sessionUser(req); res.json({ user: user ? publicUser(user) : null }); });
app.post('/api/auth/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const password = String(req.body.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Ange en giltig e-post och ett lösenord på minst 8 tecken.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Det finns redan ett konto med den e-posten.' });
  const { salt, hash } = hashPassword(password); const result = db.prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)').run(email, hash, salt);
  createSession(result.lastInsertRowid, res); res.status(201).json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)) });
});
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase(); const address = req.ip || 'unknown'; const attemptKey = address + ':' + email; const previous = loginAttempts.get(attemptKey) || { count: 0, started: Date.now() }; if (Date.now() - previous.started > loginWindowMs) { previous.count = 0; previous.started = Date.now(); } if (previous.count >= 8) return res.status(429).json({ error: 'För många försök. Vänta 15 minuter och försök igen.' }); const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !safeEqual(hashPassword(String(req.body.password || ''), user.password_salt).hash, user.password_hash)) { previous.count += 1; loginAttempts.set(attemptKey, previous); return res.status(401).json({ error: 'E-posten eller lösenordet stämmer inte.' }); }
  loginAttempts.delete(attemptKey);
  createSession(user.id, res); res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => { const user = sessionUser(req); if (user) db.prepare('DELETE FROM sessions WHERE id = ?').run(user.session_id); res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.post('/api/auth/change-password', requireUser, (req, res) => {
  const current = String(req.body.currentPassword || ''); const next = String(req.body.newPassword || '');
  if (next.length < 8) return res.status(400).json({ error: 'Det nya lösenordet måste vara minst 8 tecken.' });
  if (!safeEqual(hashPassword(current, req.user.password_salt).hash, req.user.password_hash)) return res.status(401).json({ error: 'Det nuvarande lösenordet stämmer inte.' });
  const { salt, hash } = hashPassword(next); db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, req.user.id); db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.user.id, req.user.session_id); res.json({ ok: true });
});
app.get('/api/measurements', requireUser, (req, res) => res.json({ measurements: db.prepare('SELECT id, date, data_json FROM measurements WHERE user_id = ? ORDER BY date DESC').all(req.user.id).map(row => ({ ...JSON.parse(row.data_json), id: row.id, date: row.date })) }));
app.post('/api/measurements', requireUser, (req, res) => { if (!validMeasurement(req.body)) return res.status(400).json({ error: 'Ange datum och minst ett mått.' }); const id = crypto.randomUUID(); const { date, ...data } = req.body; db.prepare('INSERT INTO measurements (id, user_id, date, data_json) VALUES (?, ?, ?, ?)').run(id, req.user.id, date, JSON.stringify(data)); res.status(201).json({ id, date, ...data }); });
app.put('/api/measurements/:id', requireUser, (req, res) => { if (!validMeasurement(req.body)) return res.status(400).json({ error: 'Ange datum och minst ett mått.' }); const { date, ...data } = req.body; const result = db.prepare('UPDATE measurements SET date = ?, data_json = ? WHERE id = ? AND user_id = ?').run(date, JSON.stringify(data), req.params.id, req.user.id); if (!result.changes) return res.status(404).json({ error: 'Mätningen hittades inte.' }); res.json({ id: req.params.id, date, ...data }); });
app.delete('/api/measurements/:id', requireUser, (req, res) => { db.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id); res.status(204).end(); });
app.get('/api/workouts', requireUser, (req, res) => res.json({ workouts: db.prepare('SELECT id, date, exercise, muscle_group, sets, reps, weight, notes FROM workouts WHERE user_id = ? ORDER BY date DESC, rowid DESC').all(req.user.id) }));
app.get('/api/workouts/stats', requireUser, (req, res) => { const total = db.prepare('SELECT COUNT(*) AS count, COALESCE(SUM(sets * reps * weight), 0) AS volume FROM workouts WHERE user_id = ?').get(req.user.id); const prs = db.prepare('SELECT exercise, MAX(weight) AS weight FROM workouts WHERE user_id = ? GROUP BY exercise ORDER BY weight DESC').all(req.user.id); res.json({ sessions: total.count, volume: total.volume, personalRecords: prs }); });
app.post('/api/workouts', requireUser, (req, res) => { const data = req.body || {}; if (!data.date || !data.exercise || !data.muscleGroup || Number(data.sets) < 1 || Number(data.reps) < 1 || Number(data.weight) < 0) return res.status(400).json({ error: 'Fyll i datum, övning, set, reps och vikt.' }); const workout = { id: crypto.randomUUID(), date: String(data.date), exercise: String(data.exercise).slice(0, 100), muscle_group: String(data.muscleGroup).slice(0, 50), sets: Number(data.sets), reps: Number(data.reps), weight: Number(data.weight), notes: String(data.notes || '').slice(0, 500) }; db.prepare('INSERT INTO workouts (id, user_id, date, exercise, muscle_group, sets, reps, weight, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(workout.id, req.user.id, workout.date, workout.exercise, workout.muscle_group, workout.sets, workout.reps, workout.weight, workout.notes); res.status(201).json(workout); });
app.delete('/api/workouts/:id', requireUser, (req, res) => { db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id); res.status(204).end(); });
app.get('/api/routine', requireUser, (req, res) => { const row = db.prepare('SELECT routine_json FROM routines WHERE user_id = ?').get(req.user.id); res.json({ routine: row ? JSON.parse(row.routine_json) : { days: [] } }); });
app.put('/api/routine', requireUser, (req, res) => {
  const routine = req.body && Array.isArray(req.body.days) ? {
    days: req.body.days.slice(0, 7).map(day => ({
      name: String(day.name || 'Träningsdag').slice(0, 50),
      exercises: Array.isArray(day.exercises) ? day.exercises.map(exercise => String(exercise).slice(0, 100)).slice(0, 30) : []
    }))
  } : { days: [] };
  db.prepare('INSERT INTO routines (user_id, routine_json) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET routine_json = excluded.routine_json').run(req.user.id, JSON.stringify(routine));
  res.json({ routine });
});
app.put('/api/profile', requireUser, (req, res) => { const profile = { ...req.body }; delete profile.email; db.prepare('UPDATE users SET profile_json = ? WHERE id = ?').run(JSON.stringify(profile), req.user.id); res.json({ profile }); });
app.delete('/api/account', requireUser, (req, res) => { db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id); res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.get('/api/admin/stats', requireUser, requireAdmin, (req, res) => res.json({ users: db.prepare('SELECT COUNT(*) AS count FROM users').get().count, admins: db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count, measurements: db.prepare('SELECT COUNT(*) AS count FROM measurements').get().count }));
app.get('/api/admin/users', requireUser, requireAdmin, (req, res) => res.json({ users: db.prepare('SELECT users.id, users.email, users.role, users.created_at, COUNT(measurements.id) AS measurement_count FROM users LEFT JOIN measurements ON measurements.user_id = users.id GROUP BY users.id ORDER BY users.created_at ASC').all() }));
app.patch('/api/admin/users/:id/role', requireUser, requireAdmin, (req, res) => {
  const role = req.body.role === 'admin' ? 'admin' : req.body.role === 'user' ? 'user' : '';
  const userId = Number(req.params.id);
  if (!role || !Number.isInteger(userId)) return res.status(400).json({ error: 'Ogiltig roll.' });
  if (userId === req.user.id && role !== 'admin') return res.status(400).json({ error: 'Du kan inte ta bort adminrollen från dig själv.' });
  const target = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'Kontot hittades inte.' });
  if (target.role === 'admin' && role === 'user' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count <= 1) return res.status(400).json({ error: 'Det måste alltid finnas minst en administratör.' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  res.json({ id: target.id, email: target.email, role });
});
app.delete('/api/admin/users/:id', requireUser, requireAdmin, (req, res) => { const userId = Number(req.params.id); if (userId === req.user.id) return res.status(400).json({ error: 'Du kan inte radera ditt eget admin-konto här.' }); const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId); if (!target) return res.status(404).json({ error: 'Kontot hittades inte.' }); if (target.role === 'admin' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count <= 1) return res.status(400).json({ error: 'Det måste alltid finnas minst en administratör.' }); db.prepare('DELETE FROM users WHERE id = ?').run(userId); res.status(204).end(); });
app.post('/api/admin/users/:id/logout', requireUser, requireAdmin, (req, res) => { db.prepare('DELETE FROM sessions WHERE user_id = ?').run(Number(req.params.id)); res.status(204).end(); });
app.use((error, req, res, next) => { console.error(error); res.status(500).json({ error: 'Ett oväntat serverfel uppstod.' }); });
app.listen(port, () => console.log(`Formkurva kör på http://localhost:${port}`));
