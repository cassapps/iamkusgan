#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');

function loadServiceAccount() {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!path) return null;
  try { return require(path); } catch (e) { return null; }
}

function yesNo(v) {
  try {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    const s = String(v || '').trim().toLowerCase();
    if (!s) return 'No';
    if (['1','yes','y','true','t'].includes(s)) return 'Yes';
    return 'No';
  } catch (e) { return 'No'; }
}

function toBool(v) {
  try {
    if (v === true) return true;
    if (v === false) return false;
    const s = String(v || '').trim().toLowerCase();
    if (!s) return false;
    return ['1','yes','y','true','t'].includes(s);
  } catch (e) { return false; }
}

async function main() {
  const svc = loadServiceAccount();
  if (!svc && !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_APPLICATION_CREDENTIALS_JSON');
    process.exit(1);
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !svc) {
    try { admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)) }); }
    catch (e) { console.error('Failed to parse JSON env var', e.message); process.exit(1); }
  } else if (svc) {
    admin.initializeApp({ credential: admin.credential.cert(svc), projectId: svc.project_id });
  }

  const db = admin.firestore();
  const col = db.collection('pricing');
  const snap = await col.get();
  console.log('Normalizing', snap.size, 'pricing docs');
  let count = 0;
  const dry = Boolean(process.env.DRY_RUN);
  for (const doc of snap.docs) {
    const id = doc.id;
    const data = doc.data();
    // Map known fields into legacy shape
    const name = data.name || data.Particulars || data.particulars || data.id || id || '';
    const price = (typeof data.price !== 'undefined') ? data.price : (typeof data.Cost !== 'undefined' ? data.Cost : null);
    const validity = data.validity_days || data.Validity || data.validity || 0;
    const gymFlag = ('is_gym_membership' in data) ? toBool(data.is_gym_membership) : toBool(data['Gym membership'] || data.gym || false);
    const coachFlag = ('is_coach_subscription' in data) ? toBool(data.is_coach_subscription) : toBool(data['Coach subscription'] || data.coach || false);
    const notes = data.notes || data.Notes || '';
    const time_window = data.time_window || data.TimeWindow || data['Time Window'] || 'any';
    const category = data.category || data.Category || '';
    const discount = toBool(data.discount || data.is_discount || false);

    // Build a patch that contains both the legacy (human-facing) shape and the canonical fields
    const patch = {
      // legacy shape kept for UI/backwards-compat
      Particulars: String(name),
      Cost: (price === null || price === undefined || price === '') ? '' : (Number(price).toFixed ? Number(price).toFixed(2) : String(price)),
      Validity: Number(validity || 0),
      'Gym membership': yesNo(gymFlag),
      'Coach subscription': yesNo(coachFlag),
      Notes: notes || '',
      // canonical fields for future-proofing
      id: data.id || id,
      name: String(name || ''),
      price: (price === null || price === undefined || price === '') ? null : Number(price),
      time_window: String(time_window || 'any'),
      is_gym_membership: Boolean(gymFlag),
      is_coach_subscription: Boolean(coachFlag),
      category: String(category || ''),
      discount: Boolean(discount),
    };

    try {
      if (dry) {
        console.log('[DRY RUN] Would patch', id, patch);
        // Note: would also remove legacy nested raw fields if present: _raw, raw
        const removals = ['_raw', 'raw'];
        console.log('[DRY RUN] Would remove nested fields if present:', removals.join(', '));
      } else {
        await col.doc(id).set(patch, { merge: true });
        // Clean up legacy nested raw containers if present
        try {
          await col.doc(id).update({ _raw: admin.firestore.FieldValue.delete(), raw: admin.firestore.FieldValue.delete() });
        } catch (e) {
          // update may fail if fields don't exist — ignore
        }
        console.log('Patched', id);
        count++;
      }
    } catch (e) {
      console.error('Failed to patch', id, e && e.message);
    }
  }
  if (dry) console.log('DRY RUN complete. No documents were modified.');
  else console.log('Completed. Patched', count, 'documents.');
  process.exit(0);
}

main().catch(e => { console.error(e && e.stack ? e.stack : e); process.exit(2); });
