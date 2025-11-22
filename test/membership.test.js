import { describe, it, expect } from 'vitest';
import { computeStatusForMember } from '../src/lib/membership.js';

function isoYearsFromNow(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

describe('computeStatusForMember', () => {
  it('marks membership active when payment has GymValidUntil in the future', () => {
    const future = isoYearsFromNow(1);
    const payments = [ { MemberID: '1', GymValidUntil: future, Particulars: 'Plan X' } ];
    const res = computeStatusForMember(payments, '1', []);
    expect(res.membershipState).toBe('active');
    expect(res.membershipEnd).toBeTruthy();
  });

  it('marks coachActive true when payment has CoachValidUntil in the future', () => {
    const future = isoYearsFromNow(1);
    const payments = [ { MemberID: '2', CoachValidUntil: future, Particulars: 'Coach Plan' } ];
    const res = computeStatusForMember(payments, '2', []);
    expect(res.coachActive).toBe(true);
    expect(res.coachEnd).toBeTruthy();
  });

  it('falls back to member-level membershipEnd when payments are absent', () => {
    const future = isoYearsFromNow(1);
    const member = { MemberID: '3', membershipEnd: future };
    const res = computeStatusForMember([], member, []);
    expect(res.membershipState).toBe('active');
  });

  it('respects pricing flags to infer gym membership from Particulars', () => {
    const future = isoYearsFromNow(1);
    const payments = [ { MemberID: '4', enddate: future, Particulars: 'Plan-A' } ];
    const pricing = [ { Particulars: 'Plan-A', 'Gym membership': 'Yes' } ];
    const res = computeStatusForMember(payments, '4', pricing);
    expect(res.membershipState).toBe('active');
  });

});
