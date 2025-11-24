import { NavLink } from "react-router-dom";
import React, { useEffect, useState } from "react";
import apiClient from "../lib/apiClient";

// Replace the helper with this
function phDateDisplay() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    weekday: "long",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).formatToParts(new Date());
  const weekday = (parts.find(p => p.type === "weekday")?.value || "").toUpperCase();
  const mon = parts.find(p => p.type === "month")?.value || "Jan";
  const day = parseInt(parts.find(p => p.type === "day")?.value || "01", 10);
  const yr  = parts.find(p => p.type === "year")?.value || "0000";
  return { weekday, text: `${mon}-${day}, ${yr}` }; // e.g., "Nov-2, 2025"
}

export default function Nav({ onLogout = () => {} }) {
  // Drive the banner from PH time
  const [datePH, setDatePH] = useState(phDateDisplay());
  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const tick = () => setDatePH(phDateDisplay());
    const id = setInterval(tick, 60_000);
    tick();
    return () => clearInterval(id);
  }, []);

  // Check current user's role so we can show Admin link only to admins
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiClient.fetchWithAuth('/auth/me');
        if (!mounted) return;
        if (!res.ok) return setIsAdmin(false);
        const json = await res.json().catch(() => ({}));
        setIsAdmin(Boolean(json?.user?.role === 'admin'));
      } catch (e) {
        setIsAdmin(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <img
            src={`${import.meta.env.BASE_URL || '/'}kusgan-logo.png`}
            onError={(e) => {
              try {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/kusgan-logo.png';
              } catch (_) {}
            }}
            alt="Kusgan logo"
            className="brand-logo"
          />

          <div className="brand-title">Kusgan</div>
        </div>

      <nav className="nav">
        <NavLink to="/" end data-label="Dashboard" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <span className="nav-icon">🏠</span>
          <span className="nav-label">Dashboard</span>
        </NavLink>

        <NavLink to="/attendance" data-label="Staff Attendance" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <span className="nav-icon">🕒</span>
          <span className="nav-label">Staff Attendance</span>
        </NavLink>

        <NavLink to="/members" data-label="All Members" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <span className="nav-icon">💪</span>
          <span className="nav-label">All Members</span>
        </NavLink>

        <hr className="nav-sep" />

        <NavLink to="/checkin" data-label="Member Check-In" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
          <span className="nav-icon">🎟️</span>
          <span className="nav-label">Member Check-In</span>
        </NavLink>

        {isAdmin && (
          <NavLink to="/admin" data-label="Admin" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
            <span className="nav-icon">🔧</span>
            <span className="nav-label">Admin</span>
          </NavLink>
        )}
      </nav>

        <div className="sidebar-footer">
          <button className="button logout-btn" onClick={onLogout} title="Logout">
            <svg className="logout-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M16 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="logout-label">Logout</span>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <button
              className="topbar-hamburger"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Toggle sidebar"
              title="Toggle sidebar"
            >
              ☰
            </button>

            <img
              className="topbar-logo"
              src={`${import.meta.env.BASE_URL || '/'}favicon.ico`}
              alt="Kusgan"
              onError={(e) => { try { e.currentTarget.onerror = null; e.currentTarget.src = '/favicon.ico'; } catch(_){} }}
            />

            <div className="topbar-title">Kusgan Fitness Gym</div>
          </div>

          <div className="topbar-right">{datePH.weekday} · {datePH.text}</div>
        </div>
      </header>
    </>
  );
}
