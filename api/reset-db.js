#!/usr/bin/env node
// api/reset-db.js
// Backup and clear the local SQLite DB used by the API server.

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(process.cwd(), 'kusgan.db');
const BACKUP_PATH = path.resolve(process.cwd(), 'kusgan.db.bak.' + Date.now());

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('No database file found at', DB_PATH);
    process.exit(1);
  }

  // backup
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('Backup created at', BACKUP_PATH);

  const db = new Database(DB_PATH);

  const tables = ['staff', 'members', 'attendance', 'payments'];
  try {
    for (const t of tables) {
      console.log('Clearing table', t);
      db.prepare(`DELETE FROM ${t}`).run();
    }
    // run VACUUM outside of transactional context
    db.exec('VACUUM');
  } catch (e) {
    console.error('Error resetting DB:', e.message || e);
    try { db.exec('ROLLBACK;'); } catch(_) {}
    db.close();
    process.exit(2);
  } finally {
    db.close();
  }

  console.log('Database tables cleared (kept schema intact).');
  process.exit(0);
}

main();
