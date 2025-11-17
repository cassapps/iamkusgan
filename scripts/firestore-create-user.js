#!/usr/bin/env node
// Usage: set GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_APPLICATION_CREDENTIALS_JSON) and run:
// node scripts/firestore-create-user.js username password role

import fs from 'fs';
import path from 'path';
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
    // Path to JSON
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(p)) {
      const svc = JSON.parse(fs.readFileSync(p, 'utf-8'));
      app = initializeApp({ credential: cert(svc) });
      return getFirestore(app);
    }
    // Try application default
    app = initializeApp({ credential: applicationDefault() });
    return getFirestore(app);
  }
  throw new Error('Missing service account configuration. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON');
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/firestore-create-user.js <username> <password> [role]');
    process.exit(1);
  }
  const [username, password, role = 'staff'] = args;
  const db = await initAdmin();
  const hash = bcrypt.hashSync(String(password), 10);
  const docRef = db.collection('users').doc(String(username));
  await docRef.set({ username: String(username), password_hash: hash, role, created_at: new Date().toISOString() }, { merge: true });
  console.log('User created/updated:', username);
}

run().catch(err => { console.error(err); process.exit(1); });
