#!/usr/bin/env node
const admin = require('firebase-admin');

async function main(){
  const key = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if(!key){
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON');
    process.exit(1);
  }
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const db = admin.firestore();
  const q = await db.collection('pricing').get();
  console.log('Pricing docs count:', q.size);
  q.forEach(d => {
    const data = d.data();
    console.log('-', d.id, '->', data.name || data.Particulars || data.title || JSON.stringify(data));
  });
  process.exit(0);
}

main().catch(e=>{console.error(e); process.exit(1)});
