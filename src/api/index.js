// Central API selector. Use Firestore when VITE_USE_FIRESTORE is 'true',
// otherwise fall back to a simple proxy that forwards to the local /api backend.
import * as firebaseApi from './firebase.js';
const API_BASE = import.meta.env.VITE_API_URL || ''; // Keep this line for context

// Enforce Firestore adapter for all client table data.
// The app should always read production Firestore data in the browser.
const useFirestore = true;

// Simple legacy proxy that calls local dev server endpoints under /api
// Legacy proxy: prefer the local sqlite-backed `/api` endpoints. Spread the Firestore
// adapter first, then declare local proxy functions so the proxy overrides Firestore
// implementations when both exist. This avoids calling the Firebase client in
// development when it's not configured.
const legacyProxy = {
  ...firebaseApi,
  // Robust fetch helpers: try multiple endpoints so the client works regardless of
  // Vite proxy rewrite or whether the backend is reached at /, /api, or localhost:4000.
  async fetchMembers() {
    if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE.replace(/\/$/, '')}/members`);
        if (r && r.ok) return r.json();
      } catch (e) {}
      return [];
    }
    const endpoints = ['/api/members', '/members', 'http://localhost:4000/members'];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep);
        if (r && r.ok) return r.json();
      } catch (e) { /* try next */ }
    }
    return [];
  },
  async fetchPayments() {
    if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE.replace(/\/$/, '')}/reports/payments`);
        if (r && r.ok) return r.json();
      } catch (e) {}
      return [];
    }
    const endpoints = ['/api/payments', '/payments', 'http://localhost:4000/payments'];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep);
        if (r && r.ok) return r.json();
      } catch (e) { /* try next */ }
    }
    return [];
  },
  async fetchGymEntries() {
    if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE.replace(/\/$/, '')}/gymEntries`);
        if (r && r.ok) return r.json();
      } catch (e) {}
      return [];
    }
    const endpoints = ['/api/gymEntries', '/gymEntries', 'http://localhost:4000/gymEntries'];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep);
        if (r && r.ok) return r.json();
      } catch (e) { /* try next */ }
    }
    return [];
  },
  async fetchPricing() {
    // Try pricing endpoint first, fallback to products if pricing is unavailable
    if (API_BASE) {
      try {
        const r = await fetch(`${API_BASE.replace(/\/$/, '')}/pricing`);
        if (r && r.ok) return r.json();
      } catch (e) {}
      try {
        const r2 = await fetch(`${API_BASE.replace(/\/$/, '')}/products`);
        if (r2 && r2.ok) return r2.json();
      } catch (e) {}
      return { rows: [] };
    }
    try {
      const r = await fetch('/api/pricing');
      if (r && r.ok) return r.json();
    } catch (e) { /* ignore */ }
    try {
      const r2 = await fetch('/api/products');
      if (r2 && r2.ok) return r2.json();
    } catch (e) { /* ignore */ }
    return { rows: [] };
  },
  async fetchSheet(name) { const r = await fetch(`/api/sheet/${encodeURIComponent(name)}`); return r.json(); },
  async insertRow(sheet, row) { const r = await fetch(`/api/insert/${encodeURIComponent(sheet)}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(row)}); return r.json(); },
};

// Build a mutable API object (do not export module namespace directly).
const api = useFirestore ? { ...firebaseApi } : { ...legacyProxy };

// Ensure a fetchPaymentsReport helper exists on the returned API object.
// Prefer the Firestore-provided named export if present, otherwise fallback
// to server reports endpoint or a safe no-op that returns empty rows.
api.fetchPaymentsReport = api.fetchPaymentsReport || firebaseApi.fetchPaymentsReport || legacyProxy.fetchPaymentsReport || (async () => ({ rows: [] }));

export default api;
