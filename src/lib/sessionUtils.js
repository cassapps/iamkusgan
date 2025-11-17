export function uniqueSessionCount(sessions) {
  try {
    const s = new Set();
    (sessions || []).forEach(rv => {
      try {
        let memberId = String(rv?.MemberID || rv?.memberid || rv?.Member || rv?.member || rv?.id || '').trim().toLowerCase();
        // fallback to nickname or member name when MemberID is missing
        if (!memberId) {
          memberId = String(rv?.NickName || rv?.nickname || rv?.Nick || rv?.nick || rv?.MemberName || rv?.member_name || '').trim().toLowerCase();
        }
        let coach = String(rv?.Coach || rv?.coach || rv?.coach_name || '').trim().toLowerCase() || 'none';
        // normalize common variants like "Coach Jojo" and "Jojo" to the same token
        try {
          coach = coach.replace(/\bcoach\b/g, '').replace(/\s+/g, '').trim() || 'none';
        } catch (e) { /* ignore */ }
        const raw = rv?.Date || rv?.date || rv?.time_in || rv?.Timestamp || '';
        let ymd = '';
        if (raw && typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw)) ymd = raw.slice(0,10);
        else if (raw && typeof raw === 'string') {
          try { ymd = new Date(raw).toISOString().slice(0,10); } catch(e){ ymd = String(raw).slice(0,10); }
        }
        if (memberId && ymd) s.add(`${memberId}::${coach}::${ymd}`);
      } catch (e) { /* ignore row */ }
    });
    return s.size;
  } catch (e) { return (sessions || []).length; }
}

export default { uniqueSessionCount };
