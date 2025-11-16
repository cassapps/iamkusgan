// Small API client helper: token storage and fetch helper
const TOKEN_KEY = 'authToken';

export function setToken(token) {
  if (!token) {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
    return;
  }
  try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}

export function clearToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
}

export async function fetchWithAuth(url, opts = {}) {
  const token = getToken();
  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, Object.assign({}, opts, { headers }));
  return res;
}

export default { setToken, getToken, clearToken, fetchWithAuth };
