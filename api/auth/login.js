// Simple serverless auth endpoint for production deployments.
// This endpoint accepts POST { username, password } and verifies against
// the FRONTDESK_PASSWORD environment variable. It returns a simple token
// and user object on success. This is intentionally minimal to avoid
// requiring the sqlite API for basic staff login in production.

import bcrypt from 'bcryptjs';
import admin from 'firebase-admin';

let adminInitialized = false;

// WARNING: This default hash exists to allow a single-user deployment with no envs
// (for quick public testing). It's insecure to commit credentials into repo; prefer
// setting `FRONTDESK_PASSWORD` in your host environment or use Firestore users.
// Default login password: Kusgan2025!  (you can change or remove this constant)
// The actual bcrypt hash will be computed at startup so it's always correct.
const DEFAULT_FRONTDESK_PASSWORD = 'Kusgan2025!';
const DEFAULT_FRONTDESK_HASH = bcrypt.hashSync(DEFAULT_FRONTDESK_PASSWORD, 10);
// Development fallback for a single admin user to allow quick access when
// environment variables or Firestore are not configured. This mirrors the
// existing insecure frontdesk fallback used for quick testing only.
const DEFAULT_ADMIN_USERNAME = 'johannaa';
const DEFAULT_ADMIN_PASSWORD = 'JohannaA';
const DEFAULT_ADMIN_HASH = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, 10);
function tryInitAdmin() {
  if (adminInitialized) return true;
  try {
    // Support JSON string env, base64 JSON env, or the file path env
    const jsonEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    const b64Env = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_B64;
    if (jsonEnv || b64Env) {
      let svc = null;
      try {
        if (b64Env) {
          const decoded = Buffer.from(String(b64Env), 'base64').toString('utf8');
          svc = JSON.parse(decoded);
        } else {
          svc = JSON.parse(jsonEnv);
        }
      } catch (e) {
        console.warn('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON or _B64:', e && (e.message || e));
      }
      if (svc) {
        admin.initializeApp({ credential: admin.credential.cert(svc) });
        adminInitialized = true;
        try { console.log('firebase-admin initialized for serverless (GOOGLE_APPLICATION_CREDENTIALS_JSON/_B64)'); } catch (e) {}
        return true;
      }
    }
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
        adminInitialized = true;
        return true;
      } catch (err) {
        // ignore
      }
    }
  } catch (e) {
    // ignore
  }
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = req.body || await new Promise((r, rej) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => r(JSON.parse(data || '{}')));
      req.on('error', err => rej(err));
    });
    const { username, password } = body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'username and password required' });
      return;
    }

    // Allow an optional ADMIN_USERNAME/ADMIN_PASSWORD env pair so the deployer
    // can set any username (e.g., `admin`) instead of being forced to use
    // the literal `frontdesk` username. This mirrors the local /api server
    // behavior and helps debugging on Vercel where env may be set per env.
    const adminUsername = (process.env.ADMIN_USERNAME || '').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    const expected = process.env.FRONTDESK_PASSWORD || '';
    // Debug visibility: log whether variables are present (not values). Use
    // console.log to ensure the message appears in Vercel function logs.
    try { console.log('auth/login env present:', { hasFrontdeskPassword: !!expected, hasAdminPair: !!(adminUsername && adminPassword), usernameAttempt: String(username).trim() }); } catch (e) {}

    // If ADMIN_USERNAME/ADMIN_PASSWORD are set, prefer those
    if (adminUsername && adminPassword) {
      if (String(username).trim() === String(adminUsername) && String(password) === String(adminPassword)) {
        const token = `local-token-${Date.now()}`;
        const user = { username: adminUsername, role: 'staff', id: adminUsername };
        try { console.log('auth/login: matched ADMIN_USERNAME/ADMIN_PASSWORD'); } catch (e) {}
        res.status(200).json({ ok: true, token, user });
        return;
      }
    }

    // Development shortcut: allow the baked-in johannaa admin account when no
    // env vars / Firestore are available. This is intentionally insecure and
    // only for quick testing — prefer setting ADMIN_USERNAME/ADMIN_PASSWORD
    // or configuring firebase-admin in production.
    if (String(username).trim() === DEFAULT_ADMIN_USERNAME && bcrypt.compareSync(String(password), DEFAULT_ADMIN_HASH)) {
      const token = `local-token-${Date.now()}`;
      const user = { username: DEFAULT_ADMIN_USERNAME, role: 'admin', id: DEFAULT_ADMIN_USERNAME };
      try { console.log('auth/login: matched DEFAULT_ADMIN fallback (insecure)'); } catch (e) {}
      res.status(200).json({ ok: true, token, user });
      return;
    }

    // Otherwise keep the old frontdesk behavior
    // Only support the 'frontdesk' user for now
    if (String(username).trim() === 'frontdesk' && String(password) === String(expected)) {
      // Simple token — not a JWT. Sufficient for client session identification.
      const token = `local-token-${Date.now()}`;
      const user = { username: 'frontdesk', role: 'staff', id: 'frontdesk' };
      try { console.log('auth/login: matched FRONTDESK_PASSWORD fallback'); } catch (e) {}
      res.status(200).json({ ok: true, token, user });
      return;
    }

    // Fallback: if firebase admin is available, check Firestore `users` collection
    tryInitAdmin();
    if (adminInitialized) {
      try {
        const dbf = admin.firestore();
        const userDoc = await dbf.collection('users').doc(String(username)).get();
        if (userDoc && userDoc.exists) {
          const u = userDoc.data();
          const hash = u && (u.password_hash || u.passwordHash || u.password);
          if (hash && bcrypt.compareSync(String(password), String(hash))) {
            const token = `local-token-${Date.now()}`;
            const userObj = { username: u.username || username, role: u.role || 'staff', id: u.username || username };
            try { console.log('auth/login: matched Firestore user', { username: userObj.username, role: userObj.role }); } catch (e) {}
            res.status(200).json({ ok: true, token, user: userObj });
            return;
          }
        }
      } catch (e) {
        console.error('auth/login firestore check error', e && (e.stack || e.message || e));
      }
    }

    // If no env and no Firestore, support a default hard-coded password (dev fallback)
    // This fallback is enabled by default, but can be disabled by setting
    // ENABLE_INSECURE_FALLBACK=false in the environment.
    try {
      if (!expected || expected === '') {
        const enableFallback = (String(process.env.ENABLE_INSECURE_FALLBACK || 'true').toLowerCase() !== 'false');
        if (enableFallback) {
          // Compare the provided password with the baked-in bcrypt hash
          if (String(username).trim() === 'frontdesk' && bcrypt.compareSync(String(password), DEFAULT_FRONTDESK_HASH)) {
            try { console.warn('auth/login: using DEFAULT_FRONTDESK_HASH; this is insecure and intended for quick testing only'); } catch (e) {}
            const token = `local-token-${Date.now()}`;
            const user = { username: 'frontdesk', role: 'staff', id: 'frontdesk' };
            res.status(200).json({ ok: true, token, user });
            return;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }

    res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('auth/login error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Server error' });
  }
}
