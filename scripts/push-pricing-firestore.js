#!/usr/bin/env node
/*
Script: push-pricing-firestore.js
Purpose: Upload local pricing.json to Firestore `pricing` collection.

Usage (recommended):
  - Provide Firebase Admin service account JSON via one of these env vars:
    * GOOGLE_APPLICATION_CREDENTIALS -> path to JSON file, OR
    * GOOGLE_APPLICATION_CREDENTIALS_JSON -> raw JSON string (base64 or plain JSON)
  - Optionally set FIREBASE_PROJECT to override project id (otherwise taken from service account)
  - REQUIRED: set CONFIRM_PUSH=true to allow writes (safety)

Example:
  export GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat ~/service-account.json)"
  export CONFIRM_PUSH=true
  node ./scripts/push-pricing-firestore.js

The script will replace or upsert documents in the `pricing` collection using each item's `id` as the document id.
*/

import fs from 'fs';
import path from 'path';
import os from 'os';
import admin from 'firebase-admin';

const PRICING_FILE = path.resolve(process.cwd(), 'pricing.json');

function exit(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function main() {
  if (!fs.existsSync(PRICING_FILE)) exit('pricing.json not found in project root.');

  const confirm = String(process.env.CONFIRM_PUSH || '').toLowerCase();
  if (confirm !== 'true') exit('CONFIRM_PUSH=true is required to run this script (safety).');

  let svc = null;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    let raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    // allow base64-encoded or raw
    try {
      const maybe = Buffer.from(raw, 'base64').toString('utf8');
      const obj = JSON.parse(maybe);
      svc = obj;
      console.log('Loaded service account from GOOGLE_APPLICATION_CREDENTIALS_JSON (base64 or JSON).');
    } catch (e) {
      try {
        svc = JSON.parse(raw);
        console.log('Loaded service account from GOOGLE_APPLICATION_CREDENTIALS_JSON (raw JSON).');
      } catch (e2) {
        exit('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON: ' + e2.message);
      }
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!fs.existsSync(p)) exit('GOOGLE_APPLICATION_CREDENTIALS path not found: ' + p);
    svc = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log('Loaded service account from file:', p);
  } else {
    exit('No service account provided. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON.');
  }

  const projectFromEnv = process.env.FIREBASE_PROJECT || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const projectId = projectFromEnv || svc.project_id;
  if (!projectId) exit('Unable to determine project id (set FIREBASE_PROJECT or ensure service account has project_id).');

  // Initialize admin SDK
  try {
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      projectId,
    });
  } catch (e) {
    // if already initialized, reuse
    try { admin.app(); } catch (_) { exit('Firebase admin init failed: ' + e.message); }
  }

  const db = admin.firestore();

  const raw = fs.readFileSync(PRICING_FILE, 'utf8');
  let pricing = null;
  try { pricing = JSON.parse(raw); } catch (e) { exit('pricing.json parse error: ' + e.message); }
  if (!Array.isArray(pricing)) exit('pricing.json must be an array of product objects.');

  console.log('Preparing to push', pricing.length, 'pricing items to project', projectId);

  // Dry run if DRY_RUN env var set
  if (String(process.env.DRY_RUN || '').toLowerCase() === 'true') {
    console.log('DRY RUN enabled - no writes will be performed. Listing first 10 items:');
    console.log(pricing.slice(0, 10));
    process.exit(0);
  }

  const col = db.collection('pricing');

  // Upsert each item using item.id as document id (if missing, generate one but warn)
  for (const item of pricing) {
    const docId = String(item.id || item.sku || '').trim();
    if (!docId) {
      console.warn('Skipping item without id/sku:', item);
      continue;
    }
    const docRef = col.doc(docId);
    // Ensure numeric fields are numbers in Firestore
    const toSet = { ...item };
    if (typeof toSet.price === 'string') {
      const n = Number(toSet.price);
      if (!Number.isNaN(n)) toSet.price = n;
    }
    try {
      await docRef.set(toSet, { merge: true });
      console.log('Upserted', docId);
    } catch (e) {
      console.error('Failed to upsert', docId, e && e.message);
    }
  }

  console.log('Completed pushing pricing to Firestore.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
