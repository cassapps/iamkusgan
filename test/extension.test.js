import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeExtension, computeStatusForMember } from '../src/lib/membership.js';

// Freeze time to a Manila-relevant date: 2025-11-16T00:00:00Z (Manila 08:00)
const FIXED = new Date('2025-11-16T00:00:00Z');

describe('extension rules (Manila TZ)', () => {
  beforeEach(() => {
    vi.setSystemTime(FIXED);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from today when no existing end (gym only)', () => {
    const start = '2025-11-16';
    const end = computeExtension({ existingEnd: null, startYmd: start, validityDays: 30 });
    expect(end).toBe('2025-12-15');
  });

  it('extends from existing end when active (gym only)', () => {
    const existing = '2025-11-20'; // active relative to 2025-11-16
    const end = computeExtension({ existingEnd: existing, startYmd: null, validityDays: 30 });
    expect(end).toBe('2025-12-20');
  });

  it('extends gym and coach independently', () => {
    // existing gym active, coach expired
    const existingGym = '2025-11-20';
    const existingCoach = '2025-11-10';
    const gymNew = computeExtension({ existingEnd: existingGym, startYmd: null, validityDays: 30 });
    const coachNew = computeExtension({ existingEnd: existingCoach, startYmd: '2025-11-16', validityDays: 30 });
    expect(gymNew).toBe('2025-12-20');
    expect(coachNew).toBe('2025-12-15');
  });

  it('computeStatusForMember picks the latest payment-provided GymValidUntil/CoachValidUntil', () => {
    const payments = [
      { MemberID: 'm1', Particulars: 'Monthly Pass', GymValidUntil: '2025-11-20' },
      { MemberID: 'm1', Particulars: 'Topup', GymValidUntil: '2025-12-20' },
      { MemberID: 'm1', Particulars: 'Coach Session', CoachValidUntil: '2025-11-25' },
    ];
    const st = computeStatusForMember(payments, 'm1', []);
    // membershipEnd and coachEnd should be Date objects corresponding to the Manila YMDs above
    const manilaY = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
    expect(manilaY(st.membershipEnd)).toBe('2025-12-20');
    expect(manilaY(st.coachEnd)).toBe('2025-11-25');
  });
});
