#!/usr/bin/env node
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '..', 'kusgan.db');
console.log('Opening DB at', DB_PATH);
const db = new Database(DB_PATH);

try {
  const update = db.prepare("UPDATE products SET price = ?, updated_at = datetime('now') WHERE sku = ?");
  const info = update.run(250, 'DAILY_TRAINER');
  console.log('Updated DAILY_TRAINER rows:', info.changes);

  // Update offpeak notes for daily offpeak and daily trainer offpeak
  const updNotes = db.prepare("UPDATE products SET notes = ?, updated_at = datetime('now') WHERE sku = ?");
  const noteText = 'Available only if member has no active Gym Membership and during 06:00-15:59 Manila time';
  const n1 = updNotes.run(noteText, 'DAILY_OFFPEAK');
  const n2 = updNotes.run('Available only if no active Gym Membership OR Coach Subscription and during 06:00-15:59 Manila time', 'DAILY_TRAINER_OFFPEAK');
  console.log('Updated notes rows:', n1.changes + n2.changes);

  // Insert DAILY_COACH_OFFPEAK if not exists
  const exists = db.prepare("SELECT COUNT(*) AS c FROM products WHERE sku = ?").get('DAILY_COACH_OFFPEAK').c;
  if (!exists) {
    const ins = db.prepare(`INSERT INTO products (sku, name, price, validity_days, is_gym_membership, is_coach_subscription, notes, created_at, updated_at)
      VALUES (@sku, @name, @price, @validity_days, @is_gym_membership, @is_coach_subscription, @notes, datetime('now'), datetime('now'))`);
    const res = ins.run({ sku: 'DAILY_COACH_OFFPEAK', name: 'Daily Coach Offpeak', price: 150, validity_days: 1, is_gym_membership: 0, is_coach_subscription: 1, notes: 'Available only from 06:00-15:59 Manila time and if no active Coach Subscription' });
    console.log('Inserted DAILY_COACH_OFFPEAK id:', res.lastInsertRowid);
  } else {
    console.log('DAILY_COACH_OFFPEAK already exists');
  }

  console.log('Done updating pricing.');
} catch (e) {
  console.error('Error updating DB:', e && e.message);
  process.exit(1);
} finally {
  db.close();
}
