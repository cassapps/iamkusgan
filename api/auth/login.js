// Simple serverless auth endpoint for production deployments.
// This endpoint accepts POST { username, password } and verifies against
// the FRONTDESK_PASSWORD environment variable. It returns a simple token
// and user object on success. This is intentionally minimal to avoid
// requiring the sqlite API for basic staff login in production.

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

    const expected = process.env.FRONTDESK_PASSWORD || '';
    // Only support the 'frontdesk' user for now
    if (String(username).trim() === 'frontdesk' && String(password) === String(expected)) {
      // Simple token — not a JWT. Sufficient for client session identification.
      const token = `local-token-${Date.now()}`;
      const user = { username: 'frontdesk', role: 'staff', id: 'frontdesk' };
      res.status(200).json({ ok: true, token, user });
      return;
    }

    res.status(401).json({ error: 'Invalid username or password' });
  } catch (err) {
    console.error('auth/login error', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Server error' });
  }
}
