#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { computeStatusForMember } from '../src/lib/membership.js';

const candidateKeys = [
  './keys/kusgan-6ca2f-266285fa1c66.json',
  './keys/kusgan-6ca2f-e75a89a117f6.json',
  './kusgan-6ca2f-266285fa1c66.json',
  './kusgan-6ca2f-e75a89a117f6.json',
];

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  for (const p of candidateKeys) {
    try {
      const abs = path.resolve(p);
      if (fs.existsSync(abs)) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = abs;
        break;
      }
    } catch (e) { /* ignore */ }
  }
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('No GOOGLE_APPLICATION_CREDENTIALS set and no local key found. Set the env var to a service account JSON.');
  process.exit(2);
}

try { admin.initializeApp({ credential: admin.credential.applicationDefault() }); } catch(e) {}
const db = admin.firestore();

(async function main(){
  try {
    console.log('Fetching pricing, payments, members from Firestore...');
    const [pricingSnap, paymentsSnap, membersSnap] = await Promise.all([
      db.collection('pricing').get(),
      db.collection('payments').get(),
      db.collection('members').get(),
    ]);

    const pricing = pricingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const payments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const members = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const byMember = new Map();
    for (const p of payments) {
      const id = String(p.MemberID || p.memberid || p.memberId || p.Member || '').trim();
      if (!id) continue;
      if (!byMember.has(id)) byMember.set(id, []);
      byMember.get(id).push(p);
    }

    for (const [mid, pays] of byMember.entries()) {
      const st = computeStatusForMember(pays, mid, pricing);
      console.log('\n=== Member', mid, '===');
      console.log('Computed status:', JSON.stringify(st, null, 2));
      console.log('Recent payments:');
      for (const p of pays.slice(0,10)) {
        console.log(' -', p.id || p._id || '', '|', p.Particulars || p.particulars || p.ProductID || p.productId || p.Product || p.product || '', '| GymValidUntil=', p.GymValidUntil || p.gymvaliduntil || '', 'CoachValidUntil=', p.CoachValidUntil || p.coachvaliduntil || '');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
})();
