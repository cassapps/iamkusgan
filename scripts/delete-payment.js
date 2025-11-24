#!/usr/bin/env node
// Safe helper to find and (optionally) delete payment documents by member and date.
// Usage:
//   # Dry run (lists candidates, no deletes)
//   node scripts/delete-payment.js --member=MEMBER_IDENTIFIER --date="Nov-19, 2025"
//
//   # Actually delete (be careful!)
//   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
//   node scripts/delete-payment.js --member=MEMBER_IDENTIFIER --date="Nov-19, 2025" --yes
//
// You can also target a single document by id:
//   node scripts/delete-payment.js --id=PAYMENT_DOC_ID --yes

import admin from 'firebase-admin';
import minimist from 'minimist';
import fs from 'fs';

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  // ignore if already initialized
}

const db = admin.firestore();

const argv = minimist(process.argv.slice(2), { boolean: ['yes'], string: ['member','date','id'] });
const DO_DELETE = !!argv.yes;
const MEMBER = argv.member;
const DATE_STR = argv.date;
const DOC_ID = argv.id;

function snippet(obj) {
  try { return JSON.stringify(obj, Object.keys(obj).slice(0,10)).slice(0,200); } catch(e){ return String(obj); }
}

async function deleteById(id) {
  const ref = db.collection('payments').doc(String(id));
  const snap = await ref.get();
  if (!snap.exists) {
    console.log('No payment document found with id', id);
    return;
  }
  console.log('Found document:', id, snippet(snap.data()));
  if (!DO_DELETE) return console.log('Dry run: pass --yes to delete');
  await ref.delete();
  console.log('Deleted', id);
}

function matchesDateInDoc(data, dateStringLower) {
  if (!dateStringLower) return false;
  // Check common date-like fields
  const dateKeys = ['date','Date','paidAt','paid_at','createdAt','created_at','DateISO','isoDate'];
  for (const k of Object.keys(data || {})) {
    const v = data[k];
    if (!v) continue;
    if (typeof v === 'string') {
      if (v.toLowerCase().includes(dateStringLower)) return true;
    }
    // Timestamp objects from admin SDK
    if (v && typeof v === 'object' && typeof v.toDate === 'function') {
      try {
        const iso = v.toDate().toISOString().slice(0,10);
        if (dateStringLower.includes(iso) || iso.includes(dateStringLower)) return true;
      } catch (e) {}
    }
  }
  return false;
}

async function findCandidates(memberIdentifier, dateString) {
  console.log('Finding payment candidates for member=', memberIdentifier, 'date=', dateString);
  // We'll fetch a reasonable subset of payments and filter client-side. If your payments
  // collection is huge, narrow the time window or provide a document id.
  const snap = await db.collection('payments').limit(1000).get();
  const candidates = [];
  const dateLower = dateString ? String(dateString).toLowerCase() : null;
  for (const d of snap.docs) {
    const data = d.data() || {};
    let matchesMember = false;
    if (!memberIdentifier) matchesMember = true; // if not provided, consider all
    else {
      const candidateFields = ['memberId','member_id','memberid','member','phone','memberPhone','member_phone','member_ref'];
      for (const f of Object.keys(data)) {
        const val = data[f];
        if (!val) continue;
        try {
          if (String(val).toLowerCase() === String(memberIdentifier).toLowerCase()) { matchesMember = true; break; }
        } catch (e) {}
      }
      // also check common named fields explicitly
      for (const f of candidateFields) {
        if (Object.prototype.hasOwnProperty.call(data, f) && String(data[f]).toLowerCase() === String(memberIdentifier).toLowerCase()) { matchesMember = true; break; }
      }
    }

    if (!matchesMember) continue;

    // date match
    const dateMatch = dateString ? matchesDateInDoc(data, dateLower) : true;
    if (dateMatch) candidates.push({ id: d.id, data });
  }
  return candidates;
}

(async function main(){
  if (!DOC_ID && !MEMBER) {
    console.error('Usage: provide --id=DOCID OR --member=MEMBER_IDENTIFIER --date="Nov-19, 2025"');
    process.exit(2);
  }

  try {
    if (DOC_ID) {
      await deleteById(DOC_ID);
      return process.exit(0);
    }

    const candidates = await findCandidates(MEMBER, DATE_STR);
    if (!candidates.length) {
      console.log('No matching payment documents found. Try a broader query or check the member identifier/date formatting.');
      return process.exit(0);
    }

    console.log('\nFound', candidates.length, 'candidate(s):');
    for (const c of candidates) {
      console.log('-', c.id, snippet(c.data));
    }

    if (!DO_DELETE) {
      console.log('\nDry run complete. To delete these documents run the same command with --yes');
      return process.exit(0);
    }

    // Confirm delete
    for (const c of candidates) {
      console.log('Deleting', c.id);
      await db.collection('payments').doc(c.id).delete();
    }
    console.log('Deleted', candidates.length, 'documents.');
    process.exit(0);
  } catch (err) {
    console.error('Error', err && err.message);
    process.exit(1);
  }
})();
