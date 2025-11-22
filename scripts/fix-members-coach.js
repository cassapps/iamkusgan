import fs from 'fs';
import path from 'path';
import { computeStatusForMember } from '../src/lib/membership.js';

const paymentsPath = path.resolve('./data/payments.json');
const membersPath = path.resolve('./data/members.json');

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

const paymentsObj = loadJSON(paymentsPath);
const membersObj = loadJSON(membersPath);
if (!paymentsObj || !membersObj) { console.error('Missing data files'); process.exit(1); }
const payments = paymentsObj.rows || paymentsObj.data || [];
const members = membersObj.rows || membersObj.data || [];

const byMember = new Map();
for (const p of payments) {
  const id = String(p.MemberID || p.memberid || p.Member || '').trim();
  if (!id) continue;
  if (!byMember.has(id)) byMember.set(id, []);
  byMember.get(id).push(p);
}

const anomalies = [];
const cleaned = members.map(m => ({ ...m }));
for (let i = 0; i < members.length; i++) {
  const m = members[i];
  const id = String(m.MemberID || m.memberid || m.id || '').trim();
  const pays = byMember.get(id) || [];
  const status = computeStatusForMember(pays, m, []);
  if (status.coachActive) {
    // check if any payment implies coach
    const hasCoachPayment = pays.some(p => {
      if (p.CoachValidUntil || p.coachvaliduntil || p.CoachUntil) return true;
      const tag = String(p.Particulars || p.particulars || p.Particular || '');
      if (/coach|trainer|pt/i.test(tag)) return true;
      return false;
    });
    if (!hasCoachPayment) {
      anomalies.push({ memberId: id, member: m, payments: pays.slice(0,5) });
      // remove coach-like fields from member copy
      const copy = { ...cleaned[i] };
      delete copy.CoachValidUntil; delete copy.coachvaliduntil; delete copy.coach_valid_until; delete copy.Coach; delete copy.coach;
      cleaned[i] = copy;
    }
  }
}

console.log('Found', anomalies.length, 'members with coachActive but no coach payment');
for (const a of anomalies) {
  console.log('- member', a.memberId, 'sample payments:', a.payments.map(p => p.Particulars || p.particulars).join(', '));
}

const out = { ok: true, cleanedCount: cleaned.length, anomaliesCount: anomalies.length, rows: cleaned };
fs.writeFileSync(path.resolve('./data/members.cleaned.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('Wrote data/members.cleaned.json');

process.exit(0);
