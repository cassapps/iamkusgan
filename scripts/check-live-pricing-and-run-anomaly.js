#!/usr/bin/env node
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { computeStatusForMember } from '../src/lib/membership.js';

// Try to find a service account key if GOOGLE_APPLICATION_CREDENTIALS not set
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

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  // ignore if already initialized
}

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

    console.log('Fetched', pricing.length, 'pricing rows,', payments.length, 'payments,', members.length, 'members');

    const byMember = new Map();
    for (const p of payments) {
      const id = String(p.MemberID || p.memberid || p.memberId || p.Member || '').trim();
      if (!id) continue;
      if (!byMember.has(id)) byMember.set(id, []);
      byMember.get(id).push(p);
    }

    const anomalies = [];
    for (const [mid, pays] of byMember.entries()) {
      const st = computeStatusForMember(pays, mid, pricing);
      if (st && st.coachActive) {
        const hasExplicit = pays.some(p => {
          if (p.CoachValidUntil || p.coachvaliduntil) return true;
          const tag = String(p.Particulars || p.particulars || p.Particular || p.particular || '');
          if (/coach|trainer|\bpt\b/i.test(tag)) return true;
          const pid = String(p.ProductID || p.productId || p.product || p.SKU || p.sku || '').trim();
          if (pid) {
            const pr = pricing.find(r => String(r.id) === pid || String((r => (r.SKU||r.sku||'') )(r)).trim() === pid || String(r.name || '').toLowerCase() === pid.toLowerCase());
            if (pr) {
              if (pr.coach || pr.coachOnly || pr.coach_only || pr.isCoach || pr.category === 'coach' || pr.type === 'coach') return true;
            }
          }
          return false;
        });
        if (!hasExplicit) anomalies.push({ memberId: mid, payments: pays.slice(0,5) });
      }
    }

    console.log('Found', anomalies.length, 'anomalies (coachActive true but no explicit coach payment):');
    for (const a of anomalies) {
      console.log('- Member', a.memberId);
      for (const p of a.payments) console.log('   ', p.Particulars || p.particulars || p.ProductID || p.productId || p.id, p.GymValidUntil, p.CoachValidUntil);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking Firestore:', err.message || err);
    process.exit(2);
  }
})();
