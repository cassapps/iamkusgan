import { describe, it, expect } from 'vitest';
import { uniqueSessionCount } from '../src/lib/sessionUtils';

describe('uniqueSessionCount', () => {
  it('counts multiple entries for same member+date as one', () => {
    const rows = [
      { MemberID: '42', Date: '2025-11-16', TimeIn: '09:00' },
      { MemberID: '42', Date: '2025-11-16', TimeIn: '11:00' },
      { MemberID: '43', Date: '2025-11-16', TimeIn: '12:00' },
      { MemberID: '42', Date: '2025-11-17', TimeIn: '09:00' },
    ];
    const count = uniqueSessionCount(rows);
    // Expect member 42 on 2025-11-16 counted once, member 43 once, and member 42 on 11-17 once => 3
    expect(count).toBe(3);
  });

  it('returns 0 for empty array', () => {
    expect(uniqueSessionCount([])).toBe(0);
  });
});
