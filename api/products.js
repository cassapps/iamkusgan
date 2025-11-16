// Helper functions for product purchase rules and date computations
export function isActiveDate(dateStr, now = new Date()) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d)) return false;
  // compare date only (start of day)
  const ad = new Date(d);
  ad.setHours(0,0,0,0);
  const an = new Date(now);
  an.setHours(0,0,0,0);
  return ad >= an;
}

export function validatePurchaseRules(member = {}, product = {}, now = new Date()) {
  const sku = String(product.sku || '').toUpperCase();
  const existingMembershipEnd = member.membership_end ? new Date(member.membership_end) : null;
  const existingCoachEnd = member.coach_subscription_end ? new Date(member.coach_subscription_end) : null;
  const isMembershipActive = existingMembershipEnd && existingMembershipEnd >= new Date(new Date().setHours(0,0,0,0));
  const isCoachActive = existingCoachEnd && existingCoachEnd >= new Date(new Date().setHours(0,0,0,0));

  // Manila hour extraction (robust): derive hour in 24h Manila time
  let manilaHour = 0;
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: '2-digit' }).formatToParts(new Date());
    manilaHour = Number(parts.find(p => p.type === 'hour')?.value || 0) || 0;
  } catch (e) {
    try {
      // Fallback: parse locale string
      const manilaHourRaw = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila', hour12: false, hour: '2-digit' });
      manilaHour = Number(String(manilaHourRaw).replace(/^0/, '')) || 0;
    } catch (ee) { manilaHour = 0; }
  }

  // Define windows: off-peak 06:00-14:59, daily 15:00-21:59 (Manila time)
  const inOffPeak = manilaHour >= 6 && manilaHour < 15;
  const inDailyWindow = manilaHour >= 15 && manilaHour < 22;

  if (sku === 'DAILY') {
    if (isMembershipActive) return { ok: false, error: 'Daily pass not allowed: member has active membership' };
    if (!inDailyWindow) return { ok: false, error: 'Daily pass only available 3pm-10pm (Manila time)' };
  }
  if (sku === 'DAILY_OFFPEAK') {
    if (isMembershipActive) return { ok: false, error: 'Daily pass not allowed: member has active membership' };
    if (!inOffPeak) return { ok: false, error: 'Off-peak pass only available 6am-3pm (Manila time)' };
  }
  if (sku === 'DAILY_TRAINER_OFFPEAK') {
    if (isMembershipActive) return { ok: false, error: 'Daily pass not allowed: member has active membership' };
    if (!inOffPeak) return { ok: false, error: 'Off-peak pass only available 6am-3pm (Manila time)' };
  }
  if (sku === 'COACH_SESSION') {
    if (isCoachActive) return { ok: false, error: 'Coach session not allowed: member has active coach subscription' };
  }
  if (sku === 'MONTHLY_DISC') {
    // discount eligibility: require member.student flag truthy (if present)
    const student = member.student || member.is_student || member.isStudent || false;
    if (!(student)) return { ok: false, error: 'Discounted monthly pass is restricted to students' };
  }

  return { ok: true };
}

export function computeNewEndDates(member = {}, product = {}, now = new Date()) {
  const existingMembershipEnd = member.membership_end ? new Date(member.membership_end) : null;
  const existingCoachEnd = member.coach_subscription_end ? new Date(member.coach_subscription_end) : null;
  const addDays = (base, days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + Number(days));
    return d.toISOString();
  };

  let newMembershipEnd = member.membership_end || null;
  let newCoachEnd = member.coach_subscription_end || null;
  const nowDt = new Date(now);
  if (product.is_gym_membership && Number(product.validity_days) > 0) {
    if (existingMembershipEnd && existingMembershipEnd > nowDt) {
      newMembershipEnd = addDays(existingMembershipEnd, Number(product.validity_days));
    } else {
      newMembershipEnd = addDays(nowDt, Number(product.validity_days));
    }
  }
  if (product.is_coach_subscription && Number(product.validity_days) > 0) {
    if (existingCoachEnd && existingCoachEnd > nowDt) {
      newCoachEnd = addDays(existingCoachEnd, Number(product.validity_days));
    } else {
      newCoachEnd = addDays(nowDt, Number(product.validity_days));
    }
  }
  return { newMembershipEnd, newCoachEnd };
}

export default { isActiveDate, validatePurchaseRules, computeNewEndDates };
