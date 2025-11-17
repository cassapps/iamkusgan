#!/usr/bin/env node
// Normalize existing documents in Firestore `pricing` collection to include
// legacy keys expected by the frontend: Particulars, Cost, Validity,
// 'Gym membership' (Yes/No), 'Coach subscription' (Yes/No).
// Usage: set GOOGLE_APPLICATION_CREDENTIALS then run:
//   node scripts/firestore-normalize-pricing.js

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

function yesNo(v){ return !!v ? 'Yes' : 'No'; }

async function normalize(){
  console.log('Normalizing pricing docs...');
  const snap = await db.collection('pricing').get();
  if (snap.empty) { console.log('No pricing docs found'); return; }
  let count=0;
  for (const doc of snap.docs){
    const data = doc.data();
    const name = data.name || (data._raw && (data._raw.name || data._raw.Particulars)) || '';
    const price = (typeof data.price !== 'undefined' && data.price !== null) ? Number(data.price) : (data._raw && (data._raw.price || data._raw.Cost) ? Number(data._raw.price || data._raw.Cost) : null);
    const validity = data.validity_days || data.validity_days === 0 ? data.validity_days : (data._raw && (data._raw.validity_days || data._raw.Validity) ? Number(data._raw.validity_days || data._raw.Validity) : 0);
    const isGym = !!(data.is_gym_membership || (data._raw && (data._raw.is_gym_membership || data._raw['Gym membership'])));
    const isCoach = !!(data.is_coach_subscription || (data._raw && (data._raw.is_coach_subscription || data._raw['Coach subscription'])));

    const patch = {
      Particulars: String(name || doc.id || '').trim(),
      Cost: (price === null || typeof price === 'undefined') ? '' : (Number(price).toFixed ? Number(price).toFixed(2) : String(price)),
      Validity: Number(validity || 0),
      'Gym membership': yesNo(isGym),
      'Coach subscription': yesNo(isCoach),
    };
    try {
      await db.collection('pricing').doc(doc.id).set(patch, { merge: true });
      count++;
    } catch (e){ console.error('Failed to update', doc.id, e && e.message); }
  }
  console.log('Normalized', count, 'pricing docs');
}

normalize().catch(err => { console.error('Normalize failed', err); process.exit(1); });
