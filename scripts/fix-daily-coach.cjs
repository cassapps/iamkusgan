#!/usr/bin/env node
const admin = require('firebase-admin');

function loadServiceAccount() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) return null;
  try {
    return require(path);
  } catch (err) {
    return null;
  }
}

async function main() {
  const svc = loadServiceAccount();
  if (svc) {
    admin.initializeApp({ credential: admin.credential.cert(svc) });
    console.log('Loaded service account from file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const obj = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    admin.initializeApp({ credential: admin.credential.cert(obj) });
    console.log('Loaded service account from JSON env var');
  } else {
    console.error('No service account found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON.');
    process.exit(1);
  }

  const db = admin.firestore();
  const docRef = db.collection('pricing').doc('daily_coach');

  // Desired fields to match daily_bundle availability (15:00-21:59 Manila)
  const update = {
    time_window: 'daily',
    notes: 'Available only if member has no active Coach Subscription and during 15:00-21:59 Manila time'
  };

  await docRef.set(update, { merge: true });
  console.log('Updated `daily_coach` document with:', update);
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(2);
});
