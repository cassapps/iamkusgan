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
  const col = db.collection('pricing');
  const snapshot = await col.get();
  console.log(`Found ${snapshot.size} pricing documents:`);
  snapshot.forEach(doc => {
    const d = doc.data();
    console.log('---');
    console.log('id:', doc.id);
    console.log('price:', d.price);
    if (d.time_window) console.log('time_window:', d.time_window);
    if (d.availability) console.log('availability:', JSON.stringify(d.availability));
    if (d.notes) console.log('notes:', d.notes);
    if (d.meta) console.log('meta:', JSON.stringify(d.meta));
  });
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(2);
});
