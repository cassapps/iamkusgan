#!/usr/bin/env node
/*
  Script: add-nickname-to-collections.js
  Purpose: For each document in the specified Firestore collections (defaults: payments, gymentries, progress),
           add a `nickname` field when missing. Attempts to resolve nickname from the linked member document
           (by common member id fields), falls back to a constructed display name.

  Usage:
    # dry run (default) - shows what would be updated
    node scripts/add-nickname-to-collections.js

    # apply changes (be careful)
    node scripts/add-nickname-to-collections.js --apply

    # specify collections
    node scripts/add-nickname-to-collections.js --collections=payments,gymentries,progress --apply

  Notes:
    - Uses Application Default Credentials. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON
      if running outside GCP (recommended for CI / local use):
        export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
    - The script is conservative: if a doc already has `nickname` it is skipped.
    - Always run without --apply first to verify changes.
*/

import admin from 'firebase-admin';
import minimist from 'minimist';

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  // ignore if already initialized
}

const db = admin.firestore();

const argv = minimist(process.argv.slice(2), { boolean: ['apply'], string: ['collections'] });
const APPLY = !!argv.apply;
const COLLECTIONS = (argv.collections || 'payments,gymentries,progress').split(',').map(s => s.trim()).filter(Boolean);

function firstOf(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return obj[k];
  }
  // case-insensitive fallback
  const lowerMap = Object.keys(obj || {}).reduce((acc, cur) => { acc[cur.toLowerCase()] = obj[cur]; return acc; }, {});
  for (const k of keys) {
    const v = lowerMap[k.toLowerCase()];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

function toDisplayName(member) {
  const last = firstOf(member, ['lastname','last_name','lastName']) || '';
  const first = firstOf(member, ['firstname','first_name','firstName']) || '';
  if (first || last) return `${first} ${last}`.trim();
  // try other fields
  const name = firstOf(member, ['name','full_name','fullname','displayName']);
  if (name) return String(name);
  return '';
}

function findMemberIdFromDoc(data) {
  const candidates = ['memberId','member_id','memberid','member','member_ref','memberId_'];
  for (const k of candidates) {
    if (Object.prototype.hasOwnProperty.call(data, k) && data[k]) return String(data[k]);
  }
  // try lowercased keys
  for (const k of Object.keys(data || {})) {
    const lk = k.toLowerCase();
    if (lk === 'memberid' || lk === 'member_id' || lk === 'member') return String(data[k]);
  }
  return null;
}

async function getMemberById(id) {
  if (!id) return null;
  try {
    // member docs may use the member id as document id, try that first
    const doc = await db.collection('members').doc(String(id)).get();
    if (doc.exists) return doc.data();
    // fallback: try to query members where common id fields match
    const snap = await db.collection('members').where('memberid', '==', id).limit(1).get();
    if (!snap.empty) return snap.docs[0].data();
    const snap2 = await db.collection('members').where('member_id', '==', id).limit(1).get();
    if (!snap2.empty) return snap2.docs[0].data();
    return null;
  } catch (err) {
    console.warn('Error fetching member', id, err && err.message);
    return null;
  }
}

function findNicknameFromMember(member) {
  if (!member) return null;
  // check common nickname fields (case-insensitive via firstOf)
  const n = firstOf(member, ['nickname','NickName','nick_name','nick','nickName','nick_name_']);
  if (n) return String(n);
  // some members may have a short name field
  const short = firstOf(member, ['shortname','displayName','name','FirstName','First_Name']);
  if (short) return String(short);
  // fallback to constructed display name using common name fields (case-insensitive)
  const disp = toDisplayName(member);
  return disp || null;
}

async function processCollection(colName) {
  console.log(`\nProcessing collection: ${colName}`);
  const colRef = db.collection(colName);
  const snapshot = await colRef.get();
  if (snapshot.empty) {
    console.log('  No documents found.');
    return { total: 0, updated: 0, skipped: 0 };
  }
  let total = 0, updated = 0, skipped = 0, failed = 0;
  for (const doc of snapshot.docs) {
    total++;
    const data = doc.data() || {};
    // If nickname already exists and is non-empty, skip. Otherwise attempt to resolve/fill it.
    if (Object.prototype.hasOwnProperty.call(data, 'nickname') && String(data.nickname || '').trim() !== '') {
      skipped++;
      continue;
    }
    // try to find nickname
    let nickname = null;
    // if doc already has a name-like field, prefer it
    const possibleName = firstOf(data, ['nickname','nick_name','nick','name','displayName']);
    if (possibleName) nickname = String(possibleName);

    // try to resolve from member doc
    const memId = findMemberIdFromDoc(data);
    if (!nickname && memId) {
      const member = await getMemberById(memId);
      const fromMember = findNicknameFromMember(member);
      if (fromMember) nickname = fromMember;
    }

    // final fallback: try to build from first/last fields on the document itself
    if (!nickname) {
      const last = firstOf(data, ['lastname','last_name','lastName']) || '';
      const first = firstOf(data, ['firstname','first_name','firstName']) || '';
      const built = `${first} ${last}`.trim();
      if (built) nickname = built;
    }

    if (!nickname) {
      // nothing found — set to empty string so field exists (optional: skip instead)
      nickname = '';
    }

    console.log(`  Doc ${doc.id}: set nickname='${nickname}'`);
    if (APPLY) {
      try {
        await doc.ref.set({ nickname }, { merge: true });
        updated++;
      } catch (err) {
        console.error('    Failed to update', doc.id, err && err.message);
        failed++;
      }
    }
  }
  console.log(`  Summary: total=${total} updated=${updated} skipped=${skipped} failed=${failed}`);
  return { total, updated, skipped, failed };
}

(async function main(){
  console.log('add-nickname-to-collections.js');
  console.log('Mode:', APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no writes)');
  console.log('Collections:', COLLECTIONS.join(', '));

  const overall = { total:0, updated:0, skipped:0, failed:0 };
  for (const c of COLLECTIONS) {
    try {
      const res = await processCollection(c);
      overall.total += res.total || 0;
      overall.updated += res.updated || 0;
      overall.skipped += res.skipped || 0;
      overall.failed += res.failed || 0;
    } catch (err) {
      console.error('Error processing collection', c, err && err.message);
    }
  }

  console.log('\nOverall summary:', overall);
  if (!APPLY) console.log("Run with --apply to perform updates (ensure you have backup/service-account access).");
  process.exit(0);
})();
