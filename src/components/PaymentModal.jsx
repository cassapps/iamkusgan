import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
const { addPayment, fetchPricing, fetchPayments } = api;
import ModalWrapper from "./ModalWrapper";
import events from "../lib/events";

const MANILA_TZ = "Asia/Manila";

// Manila today YYYY-MM-DD
const manilaTodayYMD = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

// Format any date as YYYY-MM-DD in Manila time
const toManilaYMD = (d) => {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    (async () => {
      try {
        setError("");
        let rows = [];

        // 1) Try a static pricing.json from the shipped site (force this for Pages)
        try {
          const base = String(import.meta.env.BASE_URL || '/Kusgan/');
          const staticUrls = [
            `${base}pricing.json`,
            '/Kusgan/pricing.json',
            '/pricing.json'
          ];
          for (const u of staticUrls) {
            try {
              const r = await fetch(u);
              if (r && r.ok) {
                const prods = await r.json().catch(() => null);
                if (prods && Array.isArray(prods) && prods.length > 0) {
                  rows = (prods || []).map((pr) => ({
                    Particulars: pr.name || pr.Particulars || pr.sku || `Product ${pr.id}`,
                    Cost: (typeof pr.price !== 'undefined' ? Number(pr.price) : (pr.Cost || pr.Cost === 0 ? Number(pr.Cost) : '')) !== '' ? (Number(pr.price || pr.Cost || 0)).toFixed(2) : '',
                    Validity: pr.validity_days || pr.validity || pr.Validity || 0,
                    'Gym membership': pr.is_gym_membership || pr['Gym membership'] ? 'Yes' : 'No',
                    'Coach subscription': pr.is_coach_subscription || pr['Coach subscription'] ? 'Yes' : 'No',
                    Notes: pr.notes || pr.Notes || ''
                  }));
                  console.info('[PaymentModal] loaded static pricing from', u, 'mapped rows=', rows.length);
                  break;
                }
              }
            } catch (err) {
              // try next static url
            }
          }
        } catch (e) {
          // ignore static fetch errors
        }

        // 2) If no static rows, try fetchPricing (Firestore) or legacy API endpoints
        if ((!rows || rows.length === 0)) {
          try {
            const res = await fetchPricing();
            if (res && Array.isArray(res.rows)) rows = res.rows;
            else if (res && Array.isArray(res)) rows = res;
          } catch (e) {
            // ignore
          }
        }

        // 3) If still empty, try legacy API endpoints
        if ((!rows || rows.length === 0) && typeof fetch === 'function') {
          const endpoints = ['/api/products', 'http://localhost:4000/products'];
          for (const ep of endpoints) {
            try {
              const prodRes = await fetch(ep);
              if (prodRes && prodRes.ok) {
                const prods = await prodRes.json().catch(() => null);
                if (prods && Array.isArray(prods) && prods.length > 0) {
                  rows = (prods || []).map((pr) => ({
                    Particulars: pr.name || pr.Particulars || pr.sku || `Product ${pr.id}`,
                    Cost: (typeof pr.price !== 'undefined' ? Number(pr.price) : (pr.Cost || pr.Cost === 0 ? Number(pr.Cost) : '')) !== '' ? (Number(pr.price || pr.Cost || 0)).toFixed(2) : '',
                    Validity: pr.validity_days || pr.validity || pr.Validity || 0,
                    'Gym membership': pr.is_gym_membership || pr['Gym membership'] ? 'Yes' : 'No',
                    'Coach subscription': pr.is_coach_subscription || pr['Coach subscription'] ? 'Yes' : 'No',
                    Notes: pr.notes || pr.Notes || ''
                  }));
                  break;
                }
              }
            } catch (err) {
              // try next endpoint
            }
          }
        }

        if (mounted) {
          setPricing(rows || []);
          try { console.debug('[PaymentModal] pricing loaded (final)', rows); } catch (e) {}
        }
      } catch (e) {
        if (mounted) setError(e?.message || 'Failed to load pricing');
      }
    })();
      return undefined;
    };
    const gymFlag = truthy(findVal(["Gym membership", "Gym Membership", "GymMembership", "Membership"]))
    const coachFlag = truthy(findVal(["Coach subscription", "Coach Subscription", "CoachSubscription", "Coach"]))
    return { gym: gymFlag, coach: coachFlag };
  };

const addDaysYMD = (startYMD, days = 0) => {
  if (!startYMD) return "";
  const [y, m, d] = String(startYMD).split("-").map(Number);
  if ([y, m, d].some((v) => Number.isNaN(v))) return "";
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + Number(days || 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utc);
};

export default function PaymentModal({ open, onClose, memberId, onSaved, membershipEnd, coachEnd, isStudent, birthDate }) {
  const [pricing, setPricing] = useState([]);
  const [busy, setBusy] = useState(false);
  const [memberPayments, setMemberPayments] = useState([]);
  const [form, setForm] = useState({ Particulars: "", Mode: "", Cost: "", StartDate: "", EndDate: "" });
  const [error, setError] = useState("");

  // Load pricing (Firestore -> { rows }) and fall back to legacy /api/products when needed
  useEffect(() => {
    let mounted = true;
    if (!open) {
      // clear transient state when modal closed
      setPricing([]);
      setForm({ Particulars: "", Mode: "", Cost: "", StartDate: "", EndDate: "" });
      setError("");
      return;
    }

    (async () => {
      try {
        setError("");
        // Try primary API first
        let rows = [];
        try {
          const res = await fetchPricing();
          if (res && Array.isArray(res.rows)) rows = res.rows;
          else if (res && Array.isArray(res)) rows = res;
        } catch (e) {
          // ignore and fallback below
        }

        // If we didn't get pricing rows, attempt a lightweight fallback to a static pricing
        // file (preferred for GitHub Pages), then try legacy endpoints.
        if ((!rows || rows.length === 0) && typeof fetch === "function") {
          const endpoints = [
            
            // Project-site static fallback (serves from repo root on Pages)
            "/Kusgan/pricing.json",
            // Relative root fallback
            "/pricing.json",
            // Legacy endpoints
            "/api/products",
            "http://localhost:4000/products",
          ];
          for (const ep of endpoints) {
            try {
              const prodRes = await fetch(ep);
              if (prodRes && prodRes.ok) {
                const prods = await prodRes.json().catch(() => null);
                if (prods && Array.isArray(prods) && prods.length > 0) {
                  rows = (prods || []).map((pr) => ({
                    Particulars: pr.name || pr.Particulars || pr.sku || `Product ${pr.id}`,
                    Cost: (typeof pr.price !== "undefined" ? Number(pr.price) : (pr.Cost || pr.Cost === 0 ? Number(pr.Cost) : "")) !== "" ? (Number(pr.price || pr.Cost || 0)).toFixed(2) : "",
                    Validity: pr.validity_days || pr.validity || pr.Validity || 0,
                    "Gym membership": pr.is_gym_membership || pr["Gym membership"] ? "Yes" : "No",
                    "Coach subscription": pr.is_coach_subscription || pr["Coach subscription"] ? "Yes" : "No",
                    Notes: pr.notes || pr.Notes || "",
                  }));
                  // do not set a static sentinel; always apply runtime eligibility rules
                  break;
                }
              }
            } catch (err) {
              // try next endpoint
            }
          }
          // If we're running on GitHub Pages or a project subpath, prefer the static fallback
          // Note: do not auto-enable static-mode based on host/base here.
          // We only mark a static fallback when we actually loaded a pricing.json
          // earlier (see above where endpoints containing 'pricing.json' set the sentinel).
        }

        if (mounted) setPricing(rows || []);
        // Debug: log pricing payload for troubleshooting in production
        try {
          if (typeof console !== 'undefined') console.debug('[PaymentModal] pricing loaded', rows);
        } catch (e) {}
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load pricing");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  // Load member's payments when modal opens so we can compute promo eligibility
  useEffect(() => {
    if (!open || !memberId) {
      setMemberPayments([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const res = await fetchPayments();
        const rows = res && Array.isArray(res.rows) ? res.rows : (Array.isArray(res) ? res : []);
        if (!mounted) return;
        // normalize MemberID keys and filter for this member
        const id = String(memberId).trim();
        const mine = (rows || []).filter(r => String(r.MemberID || r.memberId || r.MemberID || r.memberid || '').trim() === id);
        setMemberPayments(mine || []);
      } catch (e) {
        setMemberPayments([]);
      }
    })();
    return () => { mounted = false; };
  }, [open, memberId]);
 

  // Senior check (>= 60) based on provided birthDate
  const isSenior = useMemo(() => {
    if (!birthDate) return false;
    const b = birthDate instanceof Date ? birthDate : new Date(birthDate);
    if (isNaN(b)) return false;
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    return age >= 60;
  }, [birthDate]);

  // Manila hour detection and window flags
  const { manilaHour, isOffPeakWindow, isDailyWindow } = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: MANILA_TZ, hour12: false, hour: "2-digit" }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
    // Off-peak window: 06:00 - 14:59 (6am-3pm exclusive)
    const off = hour >= 6 && hour < 15;
    // Daily peak window: 15:00 - 21:59 (3pm-10pm exclusive)
    const daily = hour >= 15 && hour < 22;
    return { manilaHour: hour, isOffPeakWindow: off, isDailyWindow: daily };
  }, []);

  // Filter pricing based on eligibility rules
  const filteredPricing = useMemo(() => {
    // Always apply eligibility filters based on pricing fields and member status.
    // Do not auto-enable a 'static' mode when loading a static pricing.json.
    const canDiscount = !!(isStudent || isSenior);
    return (pricing || []).filter((p) => {
      const name = String(p.Particulars || p.name || "").trim();
      const flags = getFlags(p);

      // Prefer explicit pricing fields when available (time_window, discount, category)
      const timeWindowField = String(p.time_window || p.TimeWindow || p.timeWindow || p.time || "").toLowerCase();
      const categoryField = String(p.category || p.Category || "").toLowerCase();
      const discountFlag = typeof p.discount !== 'undefined' ? !!p.discount : /(student|senior|discount|disc)/i.test(name);

      // Fallback detections (backwards compat): keep regex checks as fallback
      const isOffPeakItem = timeWindowField === 'offpeak' || /off\s*-?\s*peak|offpeak/i.test(name);
      const isDailyItem = timeWindowField === 'daily' || /\bdaily\b|daily\s*pass|1[- ]?day/i.test(name) || Number(p.Validity || p.validity || p.validity_days || 0) === 1;

      // Discount items: require eligibility
      if (discountFlag && !canDiscount) return false;

      // Compute current membership/coach active flags (compare dates by day)
      const memberHasActiveMembership = (() => {
        try {
          if (!membershipEnd) return false;
          const d = new Date(membershipEnd);
          d.setHours(0,0,0,0);
          const today = new Date(); today.setHours(0,0,0,0);
          return d >= today;
        } catch (e) { return false; }
      })();
      const coachActiveNow = (() => {
        try {
          if (!coachEnd) return false;
          const d = new Date(coachEnd);
          d.setHours(0,0,0,0);
          const today = new Date(); today.setHours(0,0,0,0);
          return d >= today;
        } catch (e) { return false; }
      })();

      // Daily categories (explicit-first)
      const isDailyGymOnly = isDailyItem && flags.gym && !flags.coach;
      const isDailyCoachOnly = isDailyItem && flags.coach && !flags.gym;
      const isDailyBundle = isDailyItem && flags.gym && flags.coach;

      // New rule: coach-only items (daily or monthly) require an active gym membership.
      // If the member does not have an active gym membership, hide coach-only products.
      const isCoachOnly = flags.coach && !flags.gym;
      if (isCoachOnly && !memberHasActiveMembership) return false;

      // Apply rules per type:
      // - Daily gym-only: hide only if member has active gym membership
      if (isDailyGymOnly && memberHasActiveMembership) return false;
      // - Daily coach-only: hide only if member has active coach subscription
      if (isDailyCoachOnly && coachActiveNow) return false;
      // - Daily bundle: hide if either gym OR coach active
      if (isDailyBundle && (memberHasActiveMembership || coachActiveNow)) return false;

      // Off-peak items only visible in off-peak window
      // Exception: coach-only daily passes are available anytime (they're coach sessions)
      if (isOffPeakItem && !isOffPeakWindow && !(isDailyItem && flags.coach && !flags.gym)) return false;

      // Non-offpeak daily (regular daily) only visible in daily window
      // Exception: coach-only daily passes are available anytime
      if (isDailyItem && !isOffPeakItem && !isDailyWindow && !(flags.coach && !flags.gym)) return false;

      try { if (typeof console !== 'undefined') console.debug('[PaymentModal] filteredPricing result', { length: (pricing || []).filter(Boolean).length }); } catch (e) {}
      return true;
    });
  }, [pricing, isStudent, isSenior, isOffPeakWindow, isDailyWindow, membershipEnd, coachEnd]);

  // Clear selection if it becomes ineligible due to filters
  useEffect(() => {
    if (!form.Particulars) return;
    const stillThere = filteredPricing.some((p) => String(p.Particulars) === String(form.Particulars));
    if (!stillThere) setForm((f) => ({ ...f, Particulars: "", Cost: "", EndDate: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPricing]);

  

  // Group filtered pricing into categories for the dropdown
  const groupedPricing = useMemo(() => {
    const groups = { gymOnly: [], coachOnly: [], bundle: [], merch: [] };
    (filteredPricing || []).forEach((p) => {
      const f = getFlags(p);
      if (f.gym && !f.coach) groups.gymOnly.push(p);
      else if (!f.gym && f.coach) groups.coachOnly.push(p);
      else if (f.gym && f.coach) groups.bundle.push(p);
      else groups.merch.push(p);
    });
    return groups;
  }, [filteredPricing]);

  // Debug UI removed in production

  const onParticulars = (val) => {
    const item = (filteredPricing || []).find((r) => String(r.Particulars) === String(val));
    const cost = item ? (parseFloat(item.Cost) || 0).toFixed(2) : "";
    const validity = item ? Number(item.Validity || 0) : 0;
    const flags = getFlags(item);
    // Promo: if this is a daily pass (explicit or inferred) and the member has availed the exact same pass >=12 times in the last 30 days,
    // the next one is free.
    const timeWindowField = String(item?.time_window || item?.TimeWindow || item?.time || "").toLowerCase();
    const isDailyItem = timeWindowField === 'daily' || Number(item?.Validity || item?.validity || item?.validity_days || 0) === 1 || /\bdaily\b|daily\s*pass|1[- ]?day/i.test(String(val || ""));
    let promoApplies = false;
    if (isDailyItem && memberPayments && memberPayments.length) {
      const now = Date.now();
      const cutoff = now - (30 * 24 * 60 * 60 * 1000);
      const nameTrim = String(val || "").trim();
      const recentSame = (memberPayments || []).filter((p) => {
        try {
          const pname = String(p.Particulars || p.Particular || "").trim();
          if (pname !== nameTrim) return false;
          const d = p.Date || p.DatePaid || p.DateTime || p.timestamp || p.Timestamp || p.Time || null;
          if (!d) return false;
          let dt = new Date(d);
          if (isNaN(dt)) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) dt = new Date(String(d) + 'T00:00:00');
            else return false;
          }
          return dt.getTime() >= cutoff;
        } catch (e) { return false; }
      }).length;
      if (recentSame >= 12) promoApplies = true;
    }
  const today = manilaTodayYMD();
  // Determine extension base: if covers gym/coach and existing validity is active, start from the next day
  // Use Manila YMD string comparisons to avoid timezone/parsing differences.
  const gymCurrentYMD = membershipEnd ? toManilaYMD(membershipEnd) : "";
  const coachCurrentYMD = coachEnd ? toManilaYMD(coachEnd) : "";
  // Compute separate bases for gym and coach so they don't force a single shared start
  const gymBase = flags.gym
    ? (gymCurrentYMD && gymCurrentYMD >= today ? addDaysYMD(gymCurrentYMD, 1) : today)
    : null;
  const coachBase = flags.coach
    ? (coachCurrentYMD && coachCurrentYMD >= today ? addDaysYMD(coachCurrentYMD, 1) : today)
    : null;

  // Determine a sensible default StartDate shown in the form:
  // - If item affects both gym and coach, default StartDate to today so coach (when missing)
  //   starts immediately while gym will still use gymBase when present.
  // - If only gym is affected, default to gymBase (so extension continues from current end).
  // - If only coach is affected, default to coachBase.
  // - Otherwise default to today.
  let startDefault = today;
  if (flags.gym && flags.coach) {
    startDefault = today;
  } else if (flags.gym && gymBase) {
    startDefault = gymBase;
  } else if (flags.coach && coachBase) {
    startDefault = coachBase;
  } else {
    startDefault = today;
  }

    setForm((f) => {
      const start = startDefault || f.StartDate || today;
      return {
        ...f,
        Particulars: val,
        Cost: promoApplies ? "0.00" : cost,
        StartDate: start,
        EndDate: validity ? endDateFrom(start, validity) : "",
        PromoApplied: promoApplies,
      };
    });
  };

  const onStartDate = (start) => {
    const item = (filteredPricing || []).find((r) => String(r.Particulars) === String(form.Particulars));
    const validity = item ? Number(item.Validity || 0) : 0;
    setForm((f) => ({ ...f, StartDate: start, EndDate: validity ? endDateFrom(start, validity) : "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!memberId) return setError("Missing MemberID");
    if (!form.Particulars) return setError("Select Particulars.");
    if (!form.Mode) return setError("Select a payment mode.");
    if (!form.Cost) return setError("Cost is missing for this item.");

    setBusy(true);
    setError("");
    try {
      // Derive the resulting new valid-until dates for gym/coach based on the selected item
      const item = (filteredPricing || []).find((r) => String(r.Particulars) === String(form.Particulars));
      const validity = item ? Number(item.Validity || 0) : 0;
      const flags = getFlags(item);
      // Additional client-side validation for special rules
      const timeWindowField = String(item?.time_window || item?.TimeWindow || item?.time || "").toLowerCase();
      const isDailyItem = timeWindowField === 'daily' || Number(item?.Validity || item?.validity || item?.validity_days || 0) === 1 || /\bdaily\b|daily\s*pass|1[- ]?day/i.test(String(item?.Particulars || ""));
      const isOffPeakItem = timeWindowField === 'offpeak' || /off\s*-?\s*peak|offpeak/i.test(String(item?.Particulars || ""));

      // membership active check
      const memberHasActiveMembership = (() => {
        try { if (!membershipEnd) return false; const d = new Date(membershipEnd); d.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); return d >= today; } catch(e){return false}
      })();
      if (isDailyItem && memberHasActiveMembership) {
        setError('Daily pass not allowed: member has active membership');
        setBusy(false);
        return;
      }

      // Time-window checks (Manila)
      if (isDailyItem && !isOffPeakItem) {
        if (!isDailyWindow) {
          setError('Daily pass only available 3pm-10pm (Manila time)');
          setBusy(false);
          return;
        }
      }
      if (isOffPeakItem) {
        if (!isOffPeakWindow) {
          setError('Off-peak pass only available 6am-3pm (Manila time)');
          setBusy(false);
          return;
        }
      }

      // Coach session restriction: disallow if coach subscription already active
      const coachActiveNow = (() => {
        try { if (!coachEnd) return false; const d = new Date(coachEnd); d.setHours(0,0,0,0); const today = new Date(); today.setHours(0,0,0,0); return d >= today; } catch(e){return false} }
      )();
      if (flags.coach && coachActiveNow) {
        setError('Coach session not allowed: member has active coach subscription');
        setBusy(false);
        return;
      }
  const today = manilaTodayYMD();
  const gymCurrent = membershipEnd ? toManilaYMD(membershipEnd) : "";
  const coachCurrent = coachEnd ? toManilaYMD(coachEnd) : "";
  const gymBase = flags.gym ? (gymCurrent && gymCurrent >= today ? addDaysYMD(gymCurrent, 1) : form.StartDate || today) : null;
  const coachBase = flags.coach ? (coachCurrent && coachCurrent >= today ? addDaysYMD(coachCurrent, 1) : form.StartDate || today) : null;
      const gymNew = gymBase && validity ? endDateFrom(gymBase, validity) : "";
      const coachNew = coachBase && validity ? endDateFrom(coachBase, validity) : "";

      await addPayment({
        MemberID: memberId,
        Particulars: form.Particulars,
        StartDate: form.StartDate || "",
        EndDate: form.EndDate || "",
        GymValidUntil: gymNew,
        CoachValidUntil: coachNew,
        Mode: form.Mode,
        Cost: String(form.Cost).trim(),
        Date: manilaTodayYMD(),
        Time: manilaNowHM(),
      });
      if (onSaved) onSaved();
      onClose && onClose();
    } catch (e2) {
      const msg = e2?.message || "Failed to add payment";
      setError(msg);
      try { events.emit('modal:error', { message: msg, source: 'PaymentModal', error: String(e2) }); } catch(e) {}
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  // No DOM-level static fallback: rely on runtime pricing and React rendering.

    return (
  <ModalWrapper open={open} onClose={onClose} title="Add Payment" width={560} noInternalScroll={true}>
        <form onSubmit={submit} style={{ width: '100%' }}>
        {error && (
          <div className="small-error" style={{ marginBottom: 8 }}>{error}</div>
        )}

        {/* Membership validity snapshot (current only) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Gym Membership - Valid until</div>
            <div style={{ fontWeight: 700 }}>{membershipEnd ? displayManila(membershipEnd) : "-"}</div>
          </div>
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Coach Subscription - Valid until</div>
            <div style={{ fontWeight: 700 }}>{coachEnd ? displayManila(coachEnd) : "-"}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field" style={{ gridColumn: "1 / span 2" }}>
            <span className="label">Particulars</span>
            {/* If pricing rows failed to load in production, allow manual entry */}
            {( (!pricing || pricing.length === 0) || (Array.isArray(pricing) && filteredPricing && filteredPricing.length === 0) ) ? (
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                <input
                  type="text"
                  placeholder="No products loaded — enter product/service"
                  value={form.Particulars}
                  onChange={(e) => {
                    const v = e.target.value;
                    // When manually typing, treat as manual selection
                    setForm((f) => ({ ...f, Particulars: v }));
                  }}
                  required
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Cost"
                    value={form.Cost}
                    onChange={(e) => setForm((f) => ({ ...f, Cost: e.target.value }))}
                    style={{ flex: 1 }}
                    required
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Pricing data not available — enter particulars and cost manually.</div>
              </div>
            ) : (
              <select value={form.Particulars} onChange={(e) => onParticulars(e.target.value)} required>
                <option value="">Choose product/service</option>
                {groupedPricing.gymOnly.length > 0 && (
                  <optgroup label="Gym membership only">
                    {groupedPricing.gymOnly.map((p, i) => (
                      <option key={`gym-${p.Particulars}-${i}`} value={p.Particulars}>{p.Particulars}</option>
                    ))}
                  </optgroup>
                )}
                {groupedPricing.coachOnly.length > 0 && (
                  <optgroup label="Coach subscription only">
                    {groupedPricing.coachOnly.map((p, i) => (
                      <option key={`coach-${p.Particulars}-${i}`} value={p.Particulars}>{p.Particulars}</option>
                    ))}
                  </optgroup>
                )}
                {groupedPricing.bundle.length > 0 && (
                  <optgroup label="Gym & Coach bundle">
                    {groupedPricing.bundle.map((p, i) => (
                      <option key={`bundle-${p.Particulars}-${i}`} value={p.Particulars}>{p.Particulars}</option>
                    ))}
                  </optgroup>
                )}
                {groupedPricing.merch.length > 0 && (
                  <optgroup label="Merchandise">
                    {groupedPricing.merch.map((p, i) => (
                      <option key={`merch-${p.Particulars}-${i}`} value={p.Particulars}>{p.Particulars}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
            {/* New validity preview below Particulars, soft pink */}
            {form.Particulars && (() => {
              const item = (filteredPricing || []).find((r) => String(r.Particulars) === String(form.Particulars));
              const flags = getFlags(item);
              const validity = item ? Number(item.Validity || 0) : 0;
              if (!validity) return null;
              const today = manilaTodayYMD();
              const gymCurrent = membershipEnd ? toManilaYMD(membershipEnd) : "";
              const coachCurrent = coachEnd ? toManilaYMD(coachEnd) : "";
              const gymBase = flags.gym ? (gymCurrent && gymCurrent >= today ? addDaysYMD(gymCurrent, 1) : form.StartDate || today) : null;
              const coachBase = flags.coach ? (coachCurrent && coachCurrent >= today ? addDaysYMD(coachCurrent, 1) : form.StartDate || today) : null;
              const gymNew = gymBase ? endDateFrom(gymBase, validity) : null;
              const coachNew = coachBase ? endDateFrom(coachBase, validity) : null;
              if (!gymNew && !coachNew) return null;
              return (
                <div style={{ background: "#fde8ef", border: "1px solid #ffd7e3", color: "#8b1a3b", marginTop: 8, padding: 8, borderRadius: 8, fontSize: 13, lineHeight: 1.35 }}>
                  {gymNew && (
                    <div>
                      New Gym valid until: <b>{displayManila(gymNew)}</b>
                    </div>
                  )}
                  {coachNew && (
                    <div>
                      New Coach valid until: <b>{displayManila(coachNew)}</b>
                    </div>
                  )}
                </div>
              );
            })()}
            {/* debug UI removed */}
          </label>

          <label className="field">
            <span className="label">Mode of Payment</span>
            <select value={form.Mode} onChange={(e) => setForm((f) => ({ ...f, Mode: e.target.value }))} required>
              <option value="">Select mode…</option>
              <option value="Cash">Cash</option>
              <option value="GCash">GCash</option>
            </select>
          </label>

          <label className="field">
            <span className="label">Cost</span>
            <input type="number" step="0.01" min="0" value={form.Cost} readOnly={!!(!pricing || pricing.length === 0) ? false : true} disabled={!!(!pricing || pricing.length === 0) ? false : true} onChange={(e) => setForm((f) => ({ ...f, Cost: e.target.value }))} />
            {form.PromoApplied && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#065f46' }}>Promo applied — this item will be free (12 uses in last 30 days)</div>
            )}
          </label>
        </div>

        <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
          Validity is applied inclusive of the Start Date.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" className="back-btn" onClick={onClose} style={{ background: "#e5e7eb", color: "#111", fontWeight: 700 }}>Cancel</button>
          <button type="submit" className="primary-btn" disabled={busy}>+ Add Payment</button>
        </div>
        </form>
      </ModalWrapper>
    );
}
