#!/usr/bin/env node
/*
  Migration helper (template): import JSON exports (members.json, payments.json, gymEntries.json, progress.json)
  into Firestore using the Firebase Admin SDK.

  Usage:
    1) npm i firebase-admin
    2) export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
    3) node scripts/migrate-sheets-to-firestore.js ./data/members.json

  NOTE: This is a template. Customize collection names and field mappings as needed.
*/
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS env to a service account JSON file path');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function importFile(filePath, collectionName) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) throw new Error('File not found: ' + abs);
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const rows = Array.isArray(raw) ? raw : (raw.rows || raw.data || []);
  console.log(`Importing ${rows.length} rows into ${collectionName}`);
  let count = 0;
  for (const r of rows) {
    try {
      const id = String(r.MemberID || r.memberId || r.id || r.memberid || '') || undefined;
      if (id) {
        await db.collection(collectionName).doc(String(id)).set(r, { merge: true });
      } else {
        await db.collection(collectionName).add(r);
      }
      count++;
    } catch (e) {
      console.error('Failed to import row', e);
    }
  }
  console.log(`Imported ${count}/${rows.length} into ${collectionName}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error('Usage: node scripts/migrate-sheets-to-firestore.js <members.json> [payments.json] [gym.json] [progress.json]');
    process.exit(1);
  }
  const [membersFile, paymentsFile, gymFile, progressFile] = args;
  if (membersFile) await importFile(membersFile, 'members');
  if (paymentsFile) await importFile(paymentsFile, 'payments');
  if (gymFile) await importFile(gymFile, 'gymEntries');
  if (progressFile) await importFile(progressFile, 'progress');
  console.log('Migration done');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(2); });
