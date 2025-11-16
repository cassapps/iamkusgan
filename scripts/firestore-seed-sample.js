#!/usr/bin/env node
// Seed Firestore with sample members, gym entries, payments and progress rows
// Usage: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON, then:
// node scripts/firestore-seed-sample.js

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON before running this script.');
  process.exit(2);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

function randInt(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
function daysAgo(n){ const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function hhmmRandom(){ return `${String(randInt(6,21)).padStart(2,'0')}:${String(randInt(0,59)).padStart(2,'0')}`; }

const NAMES = [
  'Anne Curtis','Vice Ganda','Sarah Geronimo','Lea Salonga','Regine Velasquez',
  'Pia Wurtzbach','Catriona Gray','Alden Richards','Maine Mendoza','Kathryn Bernardo'
];

async function seed(){
  console.log('Seeding Firestore...');
  for (let i=0;i<NAMES.length;i++){
    const full = NAMES[i];
    const [first, ...rest] = full.split(' ');
    const last = rest.join(' ') || '';
    const nick = first.toUpperCase().slice(0,6) + String(Date.now()).slice(-4).slice(0,2);
    const memberSince = daysAgo(randInt(1,60));
    const memberRow = {
      NickName: nick,
      FirstName: first,
      LastName: last,
      MemberSince: memberSince,
      Email: `${nick.toLowerCase()}@example.test`,
      Mobile: `09${randInt(100000000,999999999)}`,
      createdAt: new Date().toISOString(),
    };
    const ref = await db.collection('members').add(memberRow);
    console.log('Created member', ref.id, nick);
    const memberId = ref.id;

    const gymCount = randInt(1,6);
    for (let j=0;j<gymCount;j++){
      const date = daysAgo(randInt(0,20));
      const timeIn = hhmmRandom();
      const wantOut = Math.random() > 0.3;
      const timeOut = wantOut ? hhmmRandom() : null;
      const gymRow = { Date: date, MemberID: memberId, TimeIn: timeIn };
      if (timeOut) gymRow.TimeOut = timeOut;
      await db.collection('gymEntries').add(gymRow);
    }

    const payCount = randInt(0,3);
    for (let j=0;j<payCount;j++){
      const date = daysAgo(randInt(0,60));
      const time = hhmmRandom();
      const mode = Math.random() > 0.5 ? 'Cash' : 'GCash';
      const cost = [100,200,300,500,800][randInt(0,4)];
      const particulars = ['Monthly Membership','Drop-in','PT Session','Coach Package'][randInt(0,3)];
      const payRow = { Date: date, Time: time, MemberID: memberId, Particulars: particulars, Mode: mode, Cost: cost };
      await db.collection('payments').add(payRow);
    }

    const progCount = randInt(0,2);
    for (let j=0;j<progCount;j++){
      const date = daysAgo(randInt(0,60));
      const weight = (60 + randInt(-10,20)).toString();
      const bodyFat = (20 + randInt(-5,5)).toString();
      const progRow = { Date: date, MemberID: memberId, Weight: weight, BodyFat: bodyFat, Notes: 'Sample progress' };
      await db.collection('progress').add(progRow);
    }
  }
  console.log('Seeding complete.');
}

seed().catch(err => { console.error('Seed failed', err); process.exit(1); });
