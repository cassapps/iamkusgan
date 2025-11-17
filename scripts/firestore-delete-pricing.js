#!/usr/bin/env node
// Deletes specified pricing docs by id or by Particulars match.
const admin = require('firebase-admin');
const path = require('path');

const idsToDelete = ['monthly_gym', 'coach_session', 'gym_month', 'coach_session'];
const namesToDelete = ['Monthly Gym Membership', 'Coach Session', 'Monthly Gym Membership', 'Coach Session'];

async function main() {
  const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!key) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const col = db.collection('pricing');

  // Delete by id list
  for (const id of idsToDelete) {
    try {
      const ref = col.doc(id);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.delete();
        console.log('Deleted pricing doc by id:', id);
      } else {
        console.log('No doc for id:', id);
      }
    } catch (e) {
      console.warn('Error deleting id', id, e && e.message);
    }
  }

  // Delete by Particulars/name match
  for (const name of namesToDelete) {
    try {
      const q = await col.where('Particulars', '==', name).get();
      if (!q.empty) {
        q.forEach(async (d) => {
          try { await d.ref.delete(); console.log('Deleted pricing doc by Particulars:', d.id, name); } catch (e) { console.warn('Err deleting', d.id, e && e.message); }
        });
      } else {
        // also check name or title fields
        const q2 = await col.where('name', '==', name).get();
        if (!q2.empty) {
          q2.forEach(async (d) => {
            try { await d.ref.delete(); console.log('Deleted pricing doc by name:', d.id, name); } catch (e) { console.warn('Err deleting', d.id, e && e.message); }
          });
        } else {
          console.log('No pricing doc found with Particulars/name =', name);
        }
      }
    } catch (e) {
      console.warn('Error querying for name', name, e && e.message);
    }
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
