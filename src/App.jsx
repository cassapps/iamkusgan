import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import apiClient from './lib/apiClient';

import Nav from "./components/Nav";
import Dashboard from "./pages/Dashboard";
import Members from "./pages/Members";
import MemberDetail from "./pages/MemberDetail";
import CheckIn from "./pages/CheckIn";
import StaffAttendance from "./pages/StaffAttendance";
import AdminPage from "./pages/Admin";
import GlobalToasts from "./components/GlobalToasts";
import ResetPasswordModal from "./components/ResetPasswordModal";
// Note: non-primary pages (AddMember, Payments, ProgressDetail, Staff) are
// intended to be refactored into components under `src/components/`.
// Keep routed surface minimal: Dashboard, StaffAttendance, Members, MemberDetail, CheckIn
import "./styles.css";

// Use the centralized Login page (username/password) instead of the legacy Google-only card

export default function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    const saved = apiClient.getToken();
    if (saved) setToken(saved);
  }, []);

  const handleLogin = (cred) => {
    setToken(cred);
    try { apiClient.setToken(cred); } catch (e) {}
  };

  const handleLogout = () => {
    setToken("");
    localStorage.removeItem("authToken");
  };

  // fetch current user info (username) for the topbar
  useEffect(() => {
    let mounted = true;
    if (!token) return;
    // If token is the client-side fallback created for the `frontdesk` user,
    // avoid calling /auth/me (which will 401) and set a local username.
    try {
      if (String(token).startsWith('local-token-')) {
        setUsername('FRONTDESK');
        return;
      }
    } catch (e) {}
    (async () => {
      try {
        const res = await apiClient.fetchWithAuth('/auth/me');
        if (!mounted) return;
        if (!res.ok) return setUsername('');
        const body = await res.json().catch(() => ({}));
        const uname = (body && body.user && body.user.username) ? body.user.username : '';
        setUsername(uname || '');
      } catch (e) {
        setUsername('');
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  if (!token) return <Login setToken={handleLogin} />;

  return (
    <div className="app">
      <GlobalToasts />
      <Nav onLogout={handleLogout} />
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-left">Welcome, {String(username ? username : 'YOU').toUpperCase()}</div>
          <div className="topbar-right">
            <button
              className="button"
              onClick={() => setShowResetModal(true)}
            >Reset password</button>
          </div>
        </div>
        <ResetPasswordModal open={showResetModal} onClose={() => setShowResetModal(false)} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/attendance" element={<StaffAttendance />} />
          <Route path="/members" element={<Members />} />
          {/* Canonical member detail route */}
          <Route path="/members/:memberId" element={<MemberDetail />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}