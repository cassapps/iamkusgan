import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure the server always opens the single authoritative DB at repository root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'kusgan.db');
const db = new Database(DB_PATH);

/* ---------- SCHEMA ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER,
  staff_name TEXT NOT NULL,
  time_in TEXT NOT NULL,
  time_out TEXT,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_date TEXT NOT NULL,
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  method TEXT NOT NULL,
  amount INTEGER NOT NULL
);

`);

/* ---------- GYM ENTRIES (check-ins/check-outs for members) ---------- */
/* ---------- GYM ENTRIES (check-ins/check-outs for members) ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS gymEntries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  MemberID TEXT,
  TimeIn TEXT,
  TimeOut TEXT,
  Date TEXT,
  Coach TEXT,
  Comments TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

/* ---------- PROGRESS TRACKER ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  MemberID TEXT,
  date TEXT,
  notes TEXT,
  data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

/* ---------- PRODUCTS ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  validity_days INTEGER DEFAULT 0,
  is_gym_membership INTEGER DEFAULT 0,
  is_coach_subscription INTEGER DEFAULT 0,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

/* ---------- USERS (simple auth for staff logins) ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  created_at TEXT NOT NULL
);
`);

/* ---------- WEBAUTHN CREDENTIALS FOR STAFF (optional table) ---------- */
// staff_credentials table removed (WebAuthn prototype cleaned up)

/* ---------- SEED DATA (first run only) ---------- */
const staffCount = db.prepare('SELECT COUNT(*) AS c FROM staff').get().c;
// Allow skipping seed via env var for clean test runs
if (!process.env.SKIP_DB_SEED && staffCount === 0) {
  const seed = db.prepare('INSERT INTO staff (full_name, role) VALUES (?,?)');
  seed.run('KIM ARCEO', 'PRIMARY ATTENDANT');
  seed.run('ALEX JOHNSON', 'TRAINER');
  seed.run('SARAH MILLER', 'RECEPTION');
}

const memberCount = db.prepare('SELECT COUNT(*) AS c FROM members').get().c;
if (!process.env.SKIP_DB_SEED && memberCount === 0) {
  const insert = db.prepare(`
    INSERT INTO members (id, full_name, plan, status, created_at)
    VALUES (@id, @full_name, @plan, @status, @created_at)
  `);
  const now = new Date().toISOString();
  insert.run({ id:'MBR-0001', full_name:'Alex Johnson', plan:'Monthly', status:'Active', created_at: now });
  insert.run({ id:'MBR-0002', full_name:'Sarah Miller', plan:'Quarterly', status:'Active', created_at: now });
  insert.run({ id:'MBR-0003', full_name:'Juan Dela Cruz', plan:'Trial', status:'Inactive', created_at: now });
}

const prodCount = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
if (!process.env.SKIP_DB_SEED && prodCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (sku, name, price, validity_days, is_gym_membership, is_coach_subscription, notes)
    VALUES (@sku, @name, @price, @validity_days, @is_gym_membership, @is_coach_subscription, @notes)
  `);

  const seeds = [
    { sku: 'MONTHLY', name: 'Monthly Pass', price: 1200, validity_days: 30, is_gym_membership:1, is_coach_subscription:0, notes: 'Adds 30 days to gym membership' },
    { sku: 'MONTHLY_DISC', name: 'Monthly Pass - Discounted', price: 1000, validity_days: 30, is_gym_membership:1, is_coach_subscription:0, notes: 'Discounted monthly pass' },
    { sku: 'YEARLY', name: 'Yearly Pass', price: 12000, validity_days: 365, is_gym_membership:1, is_coach_subscription:0, notes: 'Adds 365 days to gym membership' },
    { sku: 'MONTHLY_COACH', name: 'Monthly Pass w/ Coach', price: 3500, validity_days: 30, is_gym_membership:1, is_coach_subscription:1, notes: 'Adds coach subscription and membership' },
    { sku: 'MONTHLY_COACH_ONLY', name: 'Monthly Coach Only', price: 2300, validity_days: 30, is_gym_membership:0, is_coach_subscription:1, notes: 'Adds 30 days to coach subscription' },
    { sku: 'DAILY', name: 'Daily Pass', price: 100, validity_days: 1, is_gym_membership:1, is_coach_subscription:0, notes: 'Available only if no active membership; 3pm-10pm' },
    { sku: 'DAILY_OFFPEAK', name: 'Daily Pass - Off Peak', price: 70, validity_days: 1, is_gym_membership:1, is_coach_subscription:0, notes: 'Available 6am-3pm, only when no active membership' },
    { sku: 'DAILY_TRAINER', name: 'Daily Pass w/ Trainer', price: 300, validity_days: 1, is_gym_membership:1, is_coach_subscription:1, notes: 'Daily pass that also grants trainer session' },
    { sku: 'DAILY_TRAINER_OFFPEAK', name: 'Daily Pass w/ Trainer - Off Peak', price: 200, validity_days: 1, is_gym_membership:1, is_coach_subscription:1, notes: 'Off-peak daily pass with trainer' },
    { sku: 'COACH_SESSION', name: 'Daily Coach Only', price: 200, validity_days: 1, is_gym_membership:0, is_coach_subscription:1, notes: 'Single coach session' },
    { sku: 'KUSGAN_SHIRT', name: 'Kusgan Shirt', price: 600, validity_days: 0, is_gym_membership:0, is_coach_subscription:0, notes: 'Merchandise' },
    { sku: 'KUSGAN_ID', name: 'Kusgan ID', price: 150, validity_days: 0, is_gym_membership:0, is_coach_subscription:0, notes: 'ID card' }
  ];

  for (const p of seeds) insert.run(p);
  console.log('Seeded products table with default pricing');
}

// Ensure members table has columns for membership_end and coach_subscription_end (non-fatal if already present)
try {
  db.prepare("ALTER TABLE members ADD COLUMN membership_end TEXT").run();
} catch (e) { /* ignore if exists */ }
try {
  db.prepare("ALTER TABLE members ADD COLUMN coach_subscription_end TEXT").run();
} catch (e) { /* ignore if exists */ }

// Ensure payments table has product_id column to reference products (non-fatal if exists)
try {
  db.prepare("ALTER TABLE payments ADD COLUMN product_id INTEGER DEFAULT NULL").run();
} catch (e) { /* ignore if exists */ }

// Ensure users table has an `active` flag (non-fatal if already present)
try {
  db.prepare("ALTER TABLE users ADD COLUMN active INTEGER DEFAULT 1").run();
} catch (e) { /* ignore if exists */ }

// Ensure attendance table has NoOfHours column for recording duration (non-fatal if exists)
try {
  db.prepare("ALTER TABLE attendance ADD COLUMN NoOfHours REAL DEFAULT NULL").run();
} catch (e) { /* ignore if exists */ }

// Ensure attendance table has sheet-style columns used by frontend (Date, Staff, TimeIn, TimeOut)
try { db.prepare("ALTER TABLE attendance ADD COLUMN Date TEXT DEFAULT NULL").run(); } catch (e) { /* ignore */ }
try { db.prepare("ALTER TABLE attendance ADD COLUMN Staff TEXT DEFAULT NULL").run(); } catch (e) { /* ignore */ }
try { db.prepare("ALTER TABLE attendance ADD COLUMN TimeIn TEXT DEFAULT NULL").run(); } catch (e) { /* ignore */ }
try { db.prepare("ALTER TABLE attendance ADD COLUMN TimeOut TEXT DEFAULT NULL").run(); } catch (e) { /* ignore */ }

export default db;

/* ---------- Seed admin user (local/dev only) ---------- */
try {
  const u = db.prepare('SELECT COUNT(*) AS c FROM users WHERE username = ?').get('johannaa');
  if (!process.env.SKIP_DB_SEED && u.c === 0) {
    const pw = 'JohannaA';
    const hash = bcrypt.hashSync(pw, 10);
    const stmt = db.prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)');
    stmt.run('johannaa', hash, 'admin', new Date().toISOString());
    console.log('Seeded local admin user: johannaa');
  }
} catch (e) {
  console.warn('users seed error', e && e.message);
}
