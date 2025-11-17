import React, { useState } from "react";
import ModalWrapper from "./ModalWrapper";
import apiClient from "../lib/apiClient";

export default function ResetPasswordModal({ open, onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const valid = password.length >= 6 && password === confirm;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!valid) {
      setError("Passwords must match and be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.fetchWithAuth('/api/users/self/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        setError('Password change failed: ' + (txt || res.statusText || res.status));
        return;
      }
      alert('Password changed successfully');
      setPassword('');
      setConfirm('');
      onClose && onClose();
    } catch (err) {
      setError('Password change error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper open={open} onClose={onClose} title="Reset password">
      <form className="reset-password-form" onSubmit={handleSubmit}>
        <div className="reset-password-row">
          <label>New password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            autoFocus
          />
        </div>
        <div className="reset-password-row">
          <label>Confirm password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password"
          />
        </div>
        {error ? <div className="reset-password-error">{error}</div> : null}
        <div className="reset-password-actions">
          <button type="button" className="button" onClick={onClose} disabled={loading} style={{ background: '#eee', color: '#333' }}>Cancel</button>
          <button type="submit" className="button" disabled={!valid || loading} style={{ opacity: (!valid || loading) ? 0.6 : 1 }}>
            {loading ? <span className="spinner" /> : 'Change password'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}
