#!/usr/bin/env node
// Usage: set GOOGLE_APPLICATION_CREDENTIALS (or GOOGLE_APPLICATION_CREDENTIALS_JSON)
// node scripts/firestore-check-and-set-user.js <username> <password> [role]

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
    console.error('Usage: node scripts/firestore-check-and-set-user.js <username> <password> [role]');
    process.exit(1);
  }
  const [username, password, role = 'staff'] = args;
  const db = await initAdmin();
  const docRef = db.collection('users').doc(String(username));
  const doc = await docRef.get();
  if (!doc.exists) {
    console.log('User doc not found. Will create.');
    const hash = bcrypt.hashSync(String(password), 10);
    await docRef.set({ username: String(username), password_hash: hash, role, created_at: new Date().toISOString() }, { merge: true });
    console.log('Created user', username, 'with role', role);
    return;
  }
  const data = doc.data() || {};
  const hasHash = Object.prototype.hasOwnProperty.call(data, 'password_hash') && data.password_hash;
  const currentRole = data.role || null;
  if (hasHash) {
    console.log('User exists and has a password_hash. Role:', currentRole);
  } else {
    console.log('User exists but password_hash is missing. Setting password_hash now.');
    const hash = bcrypt.hashSync(String(password), 10);
    const updates = { password_hash: hash };
    if (!currentRole) updates.role = role;
    await docRef.set(updates, { merge: true });
    console.log('Updated user', username, 'with password_hash' + (currentRole ? '' : (' and role ' + role)));
  }
  // If role mismatches and provided role is different, update it
  if (currentRole && currentRole !== role) {
    console.log(`Note: existing role is '${currentRole}', not '${role}'. Leaving existing role as-is.`);
  }
}

run().catch(err => { console.error(err); process.exit(1); });
