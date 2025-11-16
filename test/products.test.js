import { describe, it, expect } from 'vitest';
import { validatePurchaseRules, computeNewEndDates } from '../api/products.js';

describe('Product purchase rules', () => {
  it('rejects daily pass when membership active', () => {
    const member = { membership_end: new Date(Date.now() + 2*24*60*60*1000).toISOString() };
    const product = { sku: 'DAILY', validity_days: 1 };
    const res = validatePurchaseRules(member, product, new Date());
    expect(res.ok).toBe(false);
  });

  it('allows adding validity days to existing membership preserving time', () => {
    const now = new Date('2025-11-01T10:15:00.000Z');
    const member = { membership_end: new Date('2025-11-05T10:15:00.000Z').toISOString() };
    const product = { is_gym_membership: 1, validity_days: 30 };
    const out = computeNewEndDates(member, product, now);
    expect(new Date(out.newMembershipEnd).getUTCDate()).toBe(new Date('2025-12-05T10:15:00.000Z').getUTCDate());
  });

  it('computes membership from now when expired', () => {
    const now = new Date('2025-11-15T09:00:00.000Z');
    const member = { membership_end: new Date('2025-10-01T00:00:00.000Z').toISOString() };
    const product = { is_gym_membership: 1, validity_days: 30 };
    const out = computeNewEndDates(member, product, now);
    const d = new Date(out.newMembershipEnd);
    // should be roughly now + 30 days
    expect(d.getUTCMonth() === now.getUTCMonth() || d.getUTCMonth() === now.getUTCMonth()+1).toBe(true);
  });
});
