// Central API selector. Use Firestore when VITE_USE_FIRESTORE is 'true',
// otherwise fall back to a simple proxy that forwards to the local /api backend.
import * as firebaseApi from './firebase.js';

const useFirestore = (import.meta.env.VITE_USE_FIRESTORE === 'true' || import.meta.env.VITE_USE_FIRESTORE === undefined);

// Simple legacy proxy that calls local dev server endpoints under /api
const legacyProxy = {
  async fetchMembers() { const r = await fetch('/api/members'); return r.json(); },
  async fetchPayments() { const r = await fetch('/api/payments'); return r.json(); },
  async fetchGymEntries() { const r = await fetch('/api/gymEntries'); return r.json(); },
  async fetchSheet(name) { const r = await fetch(`/api/sheet/${encodeURIComponent(name)}`); return r.json(); },
  async insertRow(sheet, row) { const r = await fetch(`/api/insert/${encodeURIComponent(sheet)}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(row)}); return r.json(); },
  // Fallbacks for other functions: delegate to firebase where possible
  ...firebaseApi
};

const api = useFirestore ? firebaseApi : legacyProxy;
export default api;
