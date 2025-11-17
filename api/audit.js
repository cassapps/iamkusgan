import db from './db.js';
import admin from 'firebase-admin';
import crypto from 'crypto';

const MIRROR_TO_FIRESTORE = (process.env.MIRROR_TO_FIRESTORE === undefined) ? true : (String(process.env.MIRROR_TO_FIRESTORE).toLowerCase() === 'true');

function sanitizeObj(obj, depth = 0) {
  // Shallow recursive sanitizer to remove sensitive keys like password, token, secret
  if (obj == null) return null;
  if (typeof obj === 'string') {
    // If string looks like JSON, try to parse and sanitize
    try {
      const parsed = JSON.parse(obj);
      return sanitizeObj(parsed, depth + 1);
    } catch (_) {
      // Return raw string but limit length
      return obj.length > 200 ? obj.slice(0, 200) + '... (truncated)' : obj;
    }
  }
  if (typeof obj !== 'object') return obj;
  if (depth > 2) return '[object]';
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    try {
      if (/pass(word)?|password_hash|passwordHash|token|secret|key|private/i.test(k)) {
        out[k] = '[redacted]';
        continue;
      }
      const v = obj[k];
      if (v && typeof v === 'object') out[k] = sanitizeObj(v, depth + 1);
      else if (typeof v === 'string' && v.length > 1000) out[k] = v.slice(0, 1000) + '... (truncated)';
      else out[k] = v;
    } catch (e) {
      out[k] = '[error]';
    }
  }
  return out;
}

export function logAudit({ actor = 'unknown', action = 'create', table = '', row_id = null, before = null, after = null, details = null } = {}) {
  try {
    const stmt = db.prepare(`INSERT INTO audit_logs (actor, action, table_name, row_id, before_json, after_json, details, created_at) VALUES (?,?,?,?,?,?,?,?)`);
    const beforeJson = before ? JSON.stringify(sanitizeObj(before)) : null;
    const afterJson = after ? JSON.stringify(sanitizeObj(after)) : null;
    const detailsJson = details ? JSON.stringify(sanitizeObj(details)) : null;
    stmt.run(
      actor || 'unknown',
      action || 'create',
      table || '',
      row_id == null ? null : String(row_id),
      beforeJson,
      afterJson,
      detailsJson,
      new Date().toISOString()
    );

    // Fire-and-forget mirror to Firestore when available and enabled
    try {
      if (MIRROR_TO_FIRESTORE && admin && admin.apps && admin.apps.length > 0) {
        const dbf = admin.firestore();
        const doc = {
          actor: actor || 'unknown',
          action: action || 'create',
          table_name: table || '',
          row_id: row_id == null ? null : String(row_id),
          before: before ? sanitizeObj(before) : null,
          after: after ? sanitizeObj(after) : null,
          details: details ? sanitizeObj(details) : null,
          created_at: new Date().toISOString(),
          mirroredAt: admin.firestore.FieldValue.serverTimestamp()
        };
        // Deterministic id to make mirror writes idempotent across retries.
        // Compute hash from actor+action+table_name+row_id+before+after+details
        try {
          const idSeed = JSON.stringify({ actor: doc.actor, action: doc.action, table_name: doc.table_name, row_id: doc.row_id, before: doc.before, after: doc.after, details: doc.details });
          const idHash = crypto.createHash('sha256').update(idSeed).digest('hex');
          dbf.collection('audit_logs').doc(idHash).set(doc, { merge: true }).catch((e) => { try { console.warn('audit: failed to mirror to firestore', e && e.message); } catch (_) {} });
        } catch (e) {
          try { console.warn('audit: failed to compute deterministic id', e && e.message); } catch (_) {}
        }
      }
    } catch (e) {
      try { console.warn('audit: mirror check failed', e && e.message); } catch (_) {}
    }
  } catch (e) {
    // Do not let audit failures block main flow
    try { console.warn('audit.logAudit failed', e && e.message); } catch (_) {}
  }
}

export default { logAudit };
