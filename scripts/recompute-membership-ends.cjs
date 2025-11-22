#!/usr/bin/env node
// Recompute membership_end and coach_subscription_end for all members
// based on payments and product validity_days. Runs against repo root kusgan.db

const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(process.cwd(), 'kusgan.db');
const db = new Database(dbPath);

function addDaysIso(baseIso, days) {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString();
}

function recompute() {
  const members = db.prepare('SELECT id FROM members').all();
  console.log('Members to process:', members.length);
  for (const m of members) {
    const memberId = m.id;
    // fetch payments for member ordered by id (assume chronological)
    const payments = db.prepare('SELECT * FROM payments WHERE member_id = ? ORDER BY id ASC').all(memberId);
    let membershipEnd = null;
    let coachEnd = null;
    for (const p of payments) {
      const productId = p.product_id;
      if (!productId) continue;
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      if (!prod) continue;
      const validity = Number(prod.validity_days || 0);
      const payDate = p.pay_date || (new Date().toISOString().slice(0,10));
      // base date: if existing end is in future, extend from there; else from pay date
      if (prod.is_gym_membership) {
        const base = (membershipEnd && new Date(membershipEnd) > new Date(payDate)) ? membershipEnd : (payDate + 'T00:00:00Z');
        membershipEnd = addDaysIso(base, validity);
      }
      if (prod.is_coach_subscription) {
        const base = (coachEnd && new Date(coachEnd) > new Date(payDate)) ? coachEnd : (payDate + 'T00:00:00Z');
        coachEnd = addDaysIso(base, validity);
      }
    }
    // Update members table
    db.prepare('UPDATE members SET membership_end = ?, coach_subscription_end = ? WHERE id = ?').run(membershipEnd, coachEnd, memberId);
    console.log(`Updated ${memberId}: membership_end=${membershipEnd} coach_end=${coachEnd}`);
  }
}

try {
  recompute();
  console.log('Recompute finished');
} catch (e) {
  console.error('Error during recompute:', e && e.message);
  process.exit(1);
}
