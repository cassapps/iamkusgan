#!/usr/bin/env node
// Backfill payments collection: ensure each document has `Date` and `Time` fields (Manila YMD and HH:MM)
// Usage: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json && node scripts/backfill-payments-date.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON before running this script.');
  process.exit(2);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function manilaYMD(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function manilaHM(d) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/^(\d{2}):(\d{2}).*$/, '$1:$2');
}

(async function run(){
  try {
    const snap = await db.collection('payments').get();
    console.log('Found', snap.size, 'payments');
    let updated = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const hasDate = data.Date || data.date || data.paid_on || data.createdAt || data.timestamp;
      if (data.Date && data.Time) continue; // already has both

      // determine date source
      let src = data.Date || data.date || data.paid_on || data.createdAt || data.created_at || data.timestamp || null;
      let dt = null;
      if (src && typeof src.toDate === 'function') dt = src.toDate();
      else if (src && typeof src.seconds === 'number') dt = new Date(src.seconds * 1000);
      else if (src) dt = new Date(src);
      else dt = new Date();

      if (isNaN(dt)) dt = new Date();

      const ymd = manilaYMD(dt);
      const hm = manilaHM(dt);

      await db.collection('payments').doc(doc.id).set({ Date: ymd, Time: hm }, { merge: true });
      updated++;
    }
    console.log('Backfill complete. Updated', updated, 'documents.');
    process.exit(0);
  } catch (e) {
    console.error('Backfill failed', e);
    process.exit(1);
  }
})();
