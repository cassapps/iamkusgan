#!/usr/bin/env node
import admin from 'firebase-admin';

try {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
} catch (e) {
  // ignore if already initialized
}
const db = admin.firestore();

(async function main(){
  try {
    console.log('Checking top 5 docs in `members` collection...');
    const snap = await db.collection('members').limit(5).get();
    if (snap.empty) {
      console.log('No documents found in members.');
    } else {
      snap.forEach(d => console.log(d.id, JSON.stringify(d.data()).slice(0,200)));
    }
    process.exit(0);
  } catch (err) {
    console.error('Error checking Firestore:', err.message || err);
    process.exit(2);
  }
})();
