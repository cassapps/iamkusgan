#!/usr/bin/env node
// scripts/firestore-clear-collections.js
// Deletes documents from Firestore collections in batches. Requires GOOGLE_APPLICATION_CREDENTIALS env var.

import admin from 'firebase-admin';
import path from 'path';

async function main() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    console.error('ERROR: GOOGLE_APPLICATION_CREDENTIALS must be set to the service account JSON');
    process.exit(2);
  }

  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } catch (e) {
    console.error('Failed to initialize firebase-admin:', e.message || e);
    process.exit(3);
  }

  const db = admin.firestore();

  // default collections to clear (common used by the app)
  const defaultCollections = ['members', 'payments', 'gymEntries', 'progress', 'attendance', 'pricing', 'nicknames'];

  // allow CLI to pass additional collection names
  const argv = process.argv.slice(2);
  let collectionsToClear = defaultCollections.slice();
  if (argv.length) {
    // if user passes "--all" we will list collections and clear all
    if (argv.includes('--all')) {
      console.log('Listing all collections from Firestore...');
      const cols = await db.listCollections();
      collectionsToClear = cols.map(c => c.id);
    } else {
      // merge argv with defaults
      for (const a of argv) {
        if (!collectionsToClear.includes(a)) collectionsToClear.push(a);
      }
    }
  }

  console.log('Collections to clear:', collectionsToClear.join(', '));

  for (const col of collectionsToClear) {
    try {
      console.log(`Clearing collection: ${col}`);
      const collectionRef = db.collection(col);
      // fetch docs in batches
      while (true) {
        const snap = await collectionRef.limit(500).get();
        if (snap.empty) break;
        const batch = db.batch();
        let n = 0;
        snap.docs.forEach(doc => { batch.delete(doc.ref); n++; });
        await batch.commit();
        console.log(`  deleted ${n} documents from ${col}`);
        if (snap.size < 500) break;
      }
    } catch (e) {
      console.error(`  failed to clear ${col}:`, e.message || e);
    }
  }

  console.log('Done clearing collections.');
  process.exit(0);
}

main().catch(e => { console.error('Unhandled error', e); process.exit(1); });
