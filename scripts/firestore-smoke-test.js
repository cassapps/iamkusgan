#!/usr/bin/env node
// Simple smoke test that reads a few documents from Firestore using firebase-admin
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

async function run() {
  console.log('Checking collections: members, payments, gymEntries, progress');
  const names = ['members','payments','gymEntries','progress'];
  for (const n of names) {
    const snap = await db.collection(n).limit(5).get();
    console.log(`${n}: ${snap.size} sample rows`);
    snap.forEach(d => console.log(' -', d.id, JSON.stringify(d.data()).slice(0,200)));
  }
}

run().catch(e=>{ console.error('Smoke test failed', e); process.exit(1); });
