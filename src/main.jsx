import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

// Runtime diagnostics: helps debug blank-screen issues in dev
try {
  // Build stamp to force a different bundle hash when we intentionally republish
  try { window.__BUILD_TIME__ = "2025-11-17T00:00:00Z"; } catch (e) {}
  console.log('[app] starting main.jsx', { base: import.meta.env.BASE_URL, hasClientId: Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID) });
  const rootEl = document.getElementById('root');
  if (rootEl) rootEl.innerHTML = '<div style="padding:20px;font-family:sans-serif;color:#333">Mounting Kusgan app...</div>';
} catch (e) {
  // ignore
}

// Guard: some published bundles referenced `setShowLoadingToast` in global scope
// when components were refactored. Provide a safe no-op fallback so the public
// site doesn't throw a ReferenceError if that setter isn't mounted.
try {
  if (typeof window !== 'undefined' && typeof window.setShowLoadingToast === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    window.setShowLoadingToast = function () { /* no-op fallback */ };
  }
} catch (e) {
  // ignore
}

// Render wrapped in try/catch to surface render-time errors into the DOM
try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <HashRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </HashRouter>
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
} catch (err) {
  console.error('[app] render failure', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="padding:20px;font-family:sans-serif;color:#900"><h2>Render error</h2><pre>${String(err)}</pre></div>`;
  }
}
