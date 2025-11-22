#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const OLD = 'Coach Session Only';
const NEW = 'Daily Coach Only';

// Try to set GOOGLE_APPLICATION_CREDENTIALS if not set
const candidateKeys = [
  './keys/kusgan-6ca2f-266285fa1c66.json',
  './keys/kusgan-6ca2f-e75a89a117f6.json',
  './kusgan-6ca2f-266285fa1c66.json',
  './kusgan-6ca2f-e75a89a117f6.json',
];
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  for (const p of candidateKeys) {
    try {
      const abs = path.resolve(p);
      if (fs.existsSync(abs)) { process.env.GOOGLE_APPLICATION_CREDENTIALS = abs; break; }
    } catch (e) {}
  }
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('No GOOGLE_APPLICATION_CREDENTIALS set and no local key found. Set the env var to a service account JSON.');
  process.exit(2);
}

try { admin.initializeApp({ credential: admin.credential.applicationDefault() }); } catch(e) {}
const db = admin.firestore();

(async function main(){
  try {
    console.log('Searching pricing collection for docs with name/Particulars ==', OLD);
    const snap = await db.collection('pricing').get();
    if (snap.empty) { console.log('No pricing docs found'); process.exit(0); }
    const matches = [];
    snap.forEach(d => {
      const data = d.data();
      const name = String(data.Particulars || data.particulars || data.name || '').trim();
      if (name === OLD) matches.push({ id: d.id, data });
    });
    console.log('Found', matches.length, 'matching docs');
    if (matches.length === 0) process.exit(0);

    for (const m of matches) {
      console.log('Updating doc', m.id, '-> change name to', NEW);
      await db.collection('pricing').doc(m.id).update({ Particulars: NEW, name: NEW });
    }
    console.log('Updated', matches.length, 'docs');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
})();
