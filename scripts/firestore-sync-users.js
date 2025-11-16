import admin from 'firebase-admin';
import db from '../api/db.js';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account json');
  process.exit(1);
}

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  // already initialized in server environment sometimes
}

const dbf = admin.firestore();

(async function syncUsers() {
  try {
    const rows = db.prepare('SELECT id, username, role, created_at, active FROM users').all();
    console.log(`Found ${rows.length} users in sqlite`);
    for (const r of rows) {
      const docId = String(r.username);
      await dbf.collection('users').doc(docId).set({
        username: r.username,
        role: r.role,
        created_at: r.created_at,
        active: r.active === 1
      }, { merge: true });
      console.log('Synced user', r.username);
    }
    console.log('Done');
    process.exit(0);
  } catch (e) {
    console.error('Sync failed', e && e.message);
    process.exit(2);
  }
})();
