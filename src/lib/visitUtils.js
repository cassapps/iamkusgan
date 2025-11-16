// Utilities for normalizing visit / gym entry rows
export const toKey = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "_");
export const norm = (row) => Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [toKey(k), v]));
export const firstOf = (o, ks) => {
  try {
    const obj = o || {};
    for (const k of ks) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
      const alt = Object.keys(obj).find(kk => kk.toLowerCase().replace(/\s+/g, "") === k.toLowerCase().replace(/\s+/g, ""));
      if (alt) return obj[alt];
    }
  } catch (e) {}
  return undefined;
};

export const asDate = (v) => {
  if (!v && v !== 0) return null;
  try { if (v && typeof v.toDate === 'function') return v.toDate(); } catch (e) {}
  if (v && typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  if (v instanceof Date) return v;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

// Return true if the given row looks like it DOES NOT have a meaningful TimeOut
export const isTimeOutMissingRow = (row) => {
  try {
    const n = norm(row || {});
    const candidates = [n.timeout, n.time_out, n.timeOut, n.time_out_];
    for (const c of candidates) {
      if (c && String(c).trim() !== '') {
        const parsed = asDate(c);
        if (parsed) return false;
        if (/\d/.test(String(c))) return false;
      }
    }
    const raw = String(row?.TimeOut || row?.Time_Out || row?.TimeOUT || row?.Timeout || '').trim();
    if (raw) {
      try { if (asDate(raw)) return false; } catch (e) {}
      if (/\d/.test(raw)) return false;
    }
    return true;
  } catch (e) { return true; }
};

export default { norm, firstOf, asDate, isTimeOutMissingRow };
