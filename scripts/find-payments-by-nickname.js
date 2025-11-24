#!/usr/bin/env node
// Find payments whose nickname matches (case-insensitive) a given string.
// Usage:
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//   node scripts/find-payments-by-nickname.js --nick=rafael
// Options:
//   --limit  Number of docs to fetch from payments (default 2000)

import admin from 'firebase-admin';
import minimist from 'minimist';

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {}

const db = admin.firestore();
const argv = minimist(process.argv.slice(2), { string: ['nick'], default: { limit: '2000' } });
const nick = argv.nick;
const limit = Number(argv.limit) || 2000;

if (!nick) {
  console.error('Usage: node scripts/find-payments-by-nickname.js --nick=RAFAEL');
  process.exit(2);
}

function snippet(obj) {
  try { return JSON.stringify(obj, Object.keys(obj).slice(0,10)).slice(0,200); } catch(e){ return String(obj); }
}

(async function main(){
  console.log('Searching payments for nickname (case-insensitive):', nick);
  const lower = String(nick).toLowerCase();
  const snap = await db.collection('payments').limit(limit).get();
  const matches = [];
  for (const d of snap.docs) {
    const data = d.data() || {};
    for (const key of Object.keys(data)) {
      if (key.toLowerCase() === 'nickname' || key.toLowerCase().includes('nick')) {
        const val = data[key];
        if (!val) continue;
        if (String(val).toLowerCase() === lower || String(val).toLowerCase().includes(lower)) {
          matches.push({ id: d.id, field: key, value: val, data });
          break;
        }
      }
    }
  }

  if (!matches.length) {
    console.log('No matches found in first', limit, 'payments documents.');
    console.log('Tip: Firestore field names and string values are case-sensitive in queries.');
    process.exit(0);
  }

  console.log('\nFound', matches.length, 'match(es):');
  for (const m of matches) {
    console.log('-', m.id, `field=${m.field}`, `value=${m.value}`, snippet(m.data));
  }
  process.exit(0);
})();
