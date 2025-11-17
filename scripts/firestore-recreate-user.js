#!/usr/bin/env node
// Usage: set GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_APPLICATION_CREDENTIALS_JSON)
// node scripts/firestore-recreate-user.js <username> <password> [role]

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
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/firestore-recreate-user.js <username> <password> [role]');
    process.exit(1);
  }
  const [username, password, role = 'staff'] = args;
  const db = await initAdmin();
  const docRef = db.collection('users').doc(String(username));

  // Delete existing doc if present
  try {
    const doc = await docRef.get();
    if (doc.exists) {
      await docRef.delete();
      console.log('Deleted existing user document for', username);
    } else {
      console.log('No existing user document for', username);
    }
  } catch (e) {
    console.error('Failed to delete existing user document:', e && e.message ? e.message : e);
    throw e;
  }

  // Create new user doc with bcrypt password_hash
  try {
    const hash = bcrypt.hashSync(String(password), 10);
    await docRef.set({ username: String(username), password_hash: hash, role, created_at: new Date().toISOString() });
    console.log('Created user', username, 'with role', role);
  } catch (e) {
    console.error('Failed to create user document:', e && e.message ? e.message : e);
    throw e;
  }
}

run().catch(err => { console.error(err); process.exit(1); });
