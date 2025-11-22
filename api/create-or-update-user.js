#!/usr/bin/env node
import db from './db.js';
import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];
  const role = process.argv[4] || 'staff';
  if (!username || !password) {
    console.error('Usage: node create-or-update-user.js <username> <password> [role]');
    process.exit(2);
  }

  try {
    const hash = bcrypt.hashSync(String(password), 10);
    const now = new Date().toISOString();
    const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, role = ?, active = 1 WHERE id = ?').run(hash, role, existing.id);
      console.log('Updated user', username);
    } else {
      const info = db.prepare('INSERT INTO users (username, password_hash, role, created_at, active) VALUES (?,?,?,?,1)').run(username, hash, role, now);
      console.log('Created user', username, 'id', info.lastInsertRowid);
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      } catch (e) {}
      try {
        const dbf = admin.firestore();
        const row = db.prepare('SELECT id, username, role, created_at, active FROM users WHERE username = ?').get(username);
        await dbf.collection('users').doc(String(row.username)).set({ username: row.username, role: row.role, created_at: row.created_at, active: Boolean(row.active) }, { merge: true });
        console.log('Mirrored user to Firestore', username);
      } catch (e) {
        console.warn('Failed to mirror to Firestore:', e.message || e);
      }
    }

    process.exit(0);
  } catch (e) {
    console.error('Error creating/updating user:', e && e.message);
    process.exit(1);
  }
}

main();
