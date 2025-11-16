import { GoogleLogin } from '@react-oauth/google';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { ensureFirebase } from '../lib/firebase';
import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import apiClient from '../lib/apiClient';

export default function Login({ setToken }) {

  // Use setToken from props only!
  // Remove: const [token, setToken] = useState("");

  useEffect(() => {
    // legacy Google Sheets OAuth initialization removed — app now uses Firestore.
  }, []);

  // Simple local auth state (will POST to server-backed /auth/login)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // single view: staff form first, member sign-in below (member uses Google, disabled for now)
  const navigate = useNavigate();

  const handleLocalSignIn = async (e) => {
    e && e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please enter username and password");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) {
        // Try static fallback for GitHub Pages / static hosting.
        // If server rejects or is unavailable, allow a client-side fallback
        // for the single `frontdesk` user with known password.
        const fallbackOk = (String(username).trim() === 'frontdesk' && String(password) === 'Kusgan2025!');
        if (fallbackOk) {
          const token = `local-token-${Date.now()}`;
          try { apiClient.setToken(token); } catch (e) {}
          setToken(token);
          try { console.log('Login: used client-side fallback for frontdesk'); } catch (e) {}
          try { navigate('/'); } catch (e) {}
          setLoading(false);
          return;
        }
        const json = await res.json().catch(() => ({}));
        setError(json.error || 'Invalid username or password');
        setLoading(false);
        return;
      }
      const json = await res.json();
      // Expecting { ok: true, token, user }
      if (json && json.ok && json.token) {
        // persist token for session and attach to client helper
        try { apiClient.setToken(json.token); } catch (e) {}
        setToken(json.token);
        // navigate to app root so the main app UI shows
        try { navigate('/'); } catch (e) {}
      } else {
        setError('Login failed');
      }
    } catch (err) {
      // Network or server error: try client-side fallback for frontdesk
      const fallbackOk = (String(username).trim() === 'frontdesk' && String(password) === 'Kusgan2025!');
      if (fallbackOk) {
        const token = `local-token-${Date.now()}`;
        try { apiClient.setToken(token); } catch (e) {}
        setToken(token);
        try { console.log('Login: used client-side fallback for frontdesk (network error)'); } catch (e) {}
        try { navigate('/'); } catch (e) {}
        setLoading(false);
        return;
      }
      setError('Server error — please try again');
    } finally {
      setLoading(false);
    }
  };

  // Use Firebase sign-in for Google-based member/staff login
  const handleGoogleSignIn = async () => {
    try {
      ensureFirebase();
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      // Use ID token directly with existing API by storing it as auth token
      try { apiClient.setToken(idToken); } catch (e) {}
      setToken(idToken);
      try { navigate('/'); } catch (e) {}
    } catch (err) {
      setError('Google sign-in failed');
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, rgba(255,182,213,0.94), rgba(180,196,255,0.92))",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
      }}
    >
      <div
        style={{
          width: 420,
          minHeight: 520,
          padding: "56px 48px",
          borderRadius: 28,
          background: "#11121d",
          boxShadow: "0 36px 70px rgba(0,0,0,0.40)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}kusgan-logo.png`}
          alt="Kusgan Logo"
          style={{
            width: 160,
            height: 160,
            objectFit: "cover",
            borderRadius: "22px",
            boxShadow: "0 10px 28px rgba(215,38,96,0.35)",
            marginBottom: 24,
            background: "#000",
          }}
        />

        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 8px" }}>
          Kusgan Fitness Gym
        </h1>

        {/* Staff sign-in */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 13, color: '#c9c9da', fontWeight: 600, marginBottom: 4, textAlign: 'left' }}></div>
          <form onSubmit={handleLocalSignIn} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#c9c9da", textAlign: "left" }}>Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter staff username"
            style={{ padding: 10, fontSize: 16, borderRadius: 6, border: "1px solid #2a2a36", background: '#0f1114', color: '#fff' }}
          />

          <label style={{ fontSize: 12, color: "#c9c9da", textAlign: "left" }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter staff password"
            style={{ padding: 10, fontSize: 16, borderRadius: 6, border: "1px solid #2a2a36", background: '#0f1114', color: '#fff' }}
          />

          {error && <div style={{ color: "#f44336", fontSize: 13 }}>{error}</div>}

            <button type="submit" disabled={loading} style={{ marginTop: 6, padding: 12, borderRadius: 6, background: "#1976d2", color: "#fff", border: "none", cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.8 : 1 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Member sign-in (below staff) */}
          <div style={{ marginTop: 18, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: '#c9c9da', fontWeight: 600, marginBottom: 8 }}>Sign in as Member</div>
            {/* Google sign-in intentionally hidden for public static build */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button disabled style={{ borderRadius: 8, padding: '8px 12px', background: '#fff', color: '#888', cursor: 'not-allowed', border: '1px solid #ddd', display: 'inline-flex', alignItems: 'center', gap: 10 }} aria-disabled>
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden focusable="false">
                  <path fill="#4285F4" d="M24 9.5c3.9 0 7.2 1.4 9.6 3.7l7-7C36.4 2.4 30.6 0 24 0 14.8 0 6.9 5.5 3 13.4l8 6.2C13.5 13 18 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.5 24c0-1.4-.1-2.7-.4-4H24v8h12.7c-.5 2.8-2 5.1-4.3 6.7l6.7 5.2C43.9 36.5 46.5 30.6 46.5 24z"/>
                  <path fill="#FBBC05" d="M11 29.6c-1.2-3.5-1.2-7.3 0-10.8L3 12.6C1.1 15.9 0 19.8 0 24s1.1 8.1 3 11.4l8-6.2z"/>
                  <path fill="#EA4335" d="M24 48c6.6 0 12.4-2.4 16.9-6.5l-6.7-5.2c-2.3 1.5-5 2.4-10.2 2.4-6 0-10.5-3.5-12.4-8.6l-8 6.2C6.9 42.5 14.8 48 24 48z"/>
                </svg>
                <span style={{ fontWeight: 700, color: '#6b6b6b' }}>Sign in with Google</span>
              </button>
            </div>
            <div style={{ marginTop: 8, color: '#8b8b9b', fontSize: 13 }}>Member login via Google is not yet enabled.</div>
          </div>
        </div>
      </div>
    </div>
  );
}