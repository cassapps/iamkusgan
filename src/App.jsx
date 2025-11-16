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
// Note: non-primary pages (AddMember, Payments, ProgressDetail, Staff) are
// intended to be refactored into components under `src/components/`.
// Keep routed surface minimal: Dashboard, StaffAttendance, Members, MemberDetail, CheckIn
import "./styles.css";

// Use the centralized Login page (username/password) instead of the legacy Google-only card

export default function App() {
  const [token, setToken] = useState("");

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

  if (!token) return <Login setToken={handleLogin} />;

  return (
    <div className="app">
      <GlobalToasts />
      <Nav onLogout={handleLogout} />
      <div className="main-content">
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