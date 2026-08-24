const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const sessionDays = Math.max(1, Number(process.env.SESSION_DAYS || 30));
const secureCookies = process.env.SECURE_COOKIES === 'true';
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
  CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS measurements_user_date_idx ON measurements(user_id, date);
`);

app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname), { index: 'MyHome.html' }));

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
function publicUser(user) { return { id: user.id, email: user.email, profile: JSON.parse(user.profile_json || '{}') }; }
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
  const email = String(req.body.email || '').trim().toLowerCase(); const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !safeEqual(hashPassword(String(req.body.password || ''), user.password_salt).hash, user.password_hash)) return res.status(401).json({ error: 'E-posten eller lösenordet stämmer inte.' });
  createSession(user.id, res); res.json({ user: publicUser(user) });
});
app.post('/api/auth/logout', (req, res) => { const user = sessionUser(req); if (user) db.prepare('DELETE FROM sessions WHERE id = ?').run(user.session_id); res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.get('/api/measurements', requireUser, (req, res) => res.json({ measurements: db.prepare('SELECT id, date, data_json FROM measurements WHERE user_id = ? ORDER BY date DESC').all(req.user.id).map(row => ({ ...JSON.parse(row.data_json), id: row.id, date: row.date })) }));
app.post('/api/measurements', requireUser, (req, res) => { if (!validMeasurement(req.body)) return res.status(400).json({ error: 'Ange datum och minst ett mått.' }); const id = crypto.randomUUID(); const { date, ...data } = req.body; db.prepare('INSERT INTO measurements (id, user_id, date, data_json) VALUES (?, ?, ?, ?)').run(id, req.user.id, date, JSON.stringify(data)); res.status(201).json({ id, date, ...data }); });
app.delete('/api/measurements/:id', requireUser, (req, res) => { db.prepare('DELETE FROM measurements WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id); res.status(204).end(); });
app.put('/api/profile', requireUser, (req, res) => { const profile = { ...req.body }; delete profile.email; db.prepare('UPDATE users SET profile_json = ? WHERE id = ?').run(JSON.stringify(profile), req.user.id); res.json({ profile }); });
app.delete('/api/account', requireUser, (req, res) => { db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id); res.setHeader('Set-Cookie', 'formkurva_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.use((error, req, res, next) => { console.error(error); res.status(500).json({ error: 'Ett oväntat serverfel uppstod.' }); });
app.listen(port, () => console.log(`Formkurva kör på http://localhost:${port}`));
