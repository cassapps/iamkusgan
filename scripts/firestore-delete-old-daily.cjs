#!/usr/bin/env node
const admin = require('firebase-admin');
const ids = ['daily_gym','daily_gym_peak','daily_gym_offpeak'];
(async ()=>{
  const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if(!key){ console.error('Set GOOGLE_APPLICATION_CREDENTIALS'); process.exit(1); }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const col = db.collection('pricing');
  for(const id of ids){
    try{
      const ref = col.doc(id);
      const s = await ref.get();
      if(s.exists){ await ref.delete(); console.log('Deleted', id); } else { console.log('No doc', id); }
    }catch(e){ console.warn('Err deleting', id, e && e.message); }
  }
  process.exit(0);
})();
