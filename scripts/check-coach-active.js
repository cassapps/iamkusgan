import fs from 'fs';
import path from 'path';
import { computeStatusForMember } from '../src/lib/membership.js';

const paymentsPath = path.resolve('./data/payments.json');
const raw = fs.readFileSync(paymentsPath,'utf8');
let obj = null;
try { obj = JSON.parse(raw); } catch(e) { console.error('failed parse', e); process.exit(1); }
const rows = obj.rows || obj.data || [];

const byMember = new Map();
for (const r of rows) {
  const id = String(r.MemberID || r.memberid || r.Member || '').trim();
  if (!id) continue;
  if (!byMember.has(id)) byMember.set(id, []);
  byMember.get(id).push(r);
}

const anomalies = [];
for (const [mid, pays] of byMember.entries()) {
  const st = computeStatusForMember(pays, mid, []);
  if (st.coachActive) {
    // Check if any payment has explicit CoachValidUntil or particulars mentioning coach/trainer
    const hasExplicit = pays.some(p => {
      const c = String(p.CoachValidUntil || p.coachvaliduntil || p.Coach || '').trim();
      if (c) return true;
      const tag = String(p.Particulars || p.particulars || p.Particular || '');
      if (/coach|trainer|pt/i.test(tag)) return true;
      return false;
    });
    if (!hasExplicit) anomalies.push({ memberId: mid, payments: pays.slice(0,5) });
  }
}

console.log('Found', anomalies.length, 'anomalies (coachActive true but no explicit coach payment):');
for (const a of anomalies) {
  console.log('- Member', a.memberId);
  for (const p of a.payments) console.log('   ', p.Particulars, p.GymValidUntil, p.CoachValidUntil);
}

process.exit(0);
