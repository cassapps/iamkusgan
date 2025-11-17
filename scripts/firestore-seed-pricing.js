#!/usr/bin/env node
// Seed Firestore `pricing` collection from the shipped `public/pricing.json`.
// Usage: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON, then:
//   node scripts/firestore-seed-pricing.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON before running this script.');
  process.exit(2);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const pricingPath = path.resolve(process.cwd(), 'dist', 'pricing.json');
const fallbackPath = path.resolve(process.cwd(), 'public', 'pricing.json');

async function seed() {
  console.log('Seeding Firestore `pricing` collection...');
  let raw = null;
  if (fs.existsSync(pricingPath)) raw = fs.readFileSync(pricingPath, 'utf-8');
  else if (fs.existsSync(fallbackPath)) raw = fs.readFileSync(fallbackPath, 'utf-8');
  else {
    console.error('Could not find pricing.json in dist/ or public/. Place your pricing JSON at public/pricing.json');
    process.exit(2);
  }

  let arr;
  try { arr = JSON.parse(raw); } catch (e) { console.error('pricing.json parse error', e); process.exit(2); }
  if (!Array.isArray(arr) || arr.length === 0) { console.error('pricing.json is empty or not an array'); process.exit(2); }

  // Optional: wipe existing pricing docs (CAUTION)
  console.log('This will overwrite documents in the `pricing` collection by id (if provided) or by generated slug.');
  // Proceed

  const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) || `item_${Math.random().toString(36).slice(2,8)}`;

  for (const p of arr) {
    try {
      const docId = String(p.id || p.sku || slugify(p.name || p.Particulars || p.title)).trim();
      const doc = {
        // preserve original keys so client-side mapping can read either form
        id: p.id || null,
        name: p.name || p.Particulars || p.title || null,
        price: (typeof p.price !== 'undefined') ? Number(p.price) : (typeof p.Cost !== 'undefined' ? Number(p.Cost) : null),
        validity_days: p.validity_days || p.validity || p.Validity || 0,
        is_gym_membership: !!(p.is_gym_membership || p['Gym membership'] || p['Gym Membership'] || false),
        is_coach_subscription: !!(p.is_coach_subscription || p['Coach subscription'] || p['Coach Subscription'] || false),
        notes: p.notes || p.Notes || '',
        // keep raw entry for reference
        _raw: p,
        createdAt: new Date().toISOString(),
      };
      await db.collection('pricing').doc(docId).set(doc, { merge: true });
      console.log('Wrote pricing doc', docId);
    } catch (e) {
      console.error('Failed to write pricing row', p, e && e.message);
    }
  }

  console.log('Pricing seed complete.');
}

seed().catch(err => { console.error('Seed failed', err); process.exit(1); });
