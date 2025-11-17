#!/usr/bin/env node
// Create multiple Firestore users from env/service account.
// Usage:
//   Set `GOOGLE_APPLICATION_CREDENTIALS` (path) or `GOOGLE_APPLICATION_CREDENTIALS_JSON` (JSON string),
// then run:
//   node scripts/firestore-create-users.js

import fs from 'fs';
import bcrypt from 'bcryptjs';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function initAdmin() {
  let app;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const svc = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    app = initializeApp({ credential: cert(svc) });
    return getFirestore(app);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(p)) {
      const svc = JSON.parse(fs.readFileSync(p, 'utf-8'));
      app = initializeApp({ credential: cert(svc) });
      return getFirestore(app);
    }
    app = initializeApp({ credential: applicationDefault() });
    return getFirestore(app);
  }
  throw new Error('Missing service account configuration. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON');
}

async function run() {
  const db = await initAdmin();
  const users = [
    { username: 'xyza', password: 'Kusgan2025!', role: 'staff' },
    { username: 'bezza', password: 'Kusgan2025!', role: 'staff' },
    { username: 'jeanette', password: 'Kusgan2025!', role: 'staff' },
    { username: 'sheena', password: 'Kusgan2025!', role: 'staff' },
    { username: 'patpat', password: 'Kusgan2025!', role: 'staff' },
  ];

  for (const u of users) {
    const hash = bcrypt.hashSync(String(u.password), 10);
    const docRef = db.collection('users').doc(String(u.username));
    await docRef.set({ username: u.username, password_hash: hash, role: u.role, created_at: new Date().toISOString() }, { merge: true });
    console.log('User created/updated:', u.username);
  }
}

run().catch(err => {
  console.error('Failed to create users:', err && err.message ? err.message : err);
  process.exit(1);
});
