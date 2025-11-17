# Copilot Instructions — Kusgan Fitness Gym Frontend

This file contains short, actionable guidance to help AI coding agents be productive in this repo.

## Quick summary
- Tech: React + Vite (ESM project, see `package.json` (the `"type": "module"` field)).
  - No traditional backend: the project now uses Firestore (Firebase) for persistent data instead of Google Sheets.
- Main UI: `src/components/` (reusable pieces) and `src/pages/` (views).

## Useful commands
- Install & dev: `npm install` then `npm run dev` (runs `vite`).
- Build: `npm run build` (note: copies `dist/index.html` to `dist/404.html` for GitHub Pages).
- Test: `npm test` (uses `vitest`, see `test/attendanceUtils.test.js`).
- Preview production build: `npm run preview`.

## Key patterns & where to look (examples)
- UI: create functional components in `src/components/`. Page-level routes live in `src/pages/`.
	- Example: to add a member modal, add `src/components/AddMemberModal.jsx` and wire state in `src/utils/membersStore.js` (store/hook pattern).
- Modals: implemented as components (see `ModalWrapper.jsx`, `CameraModal.jsx`, `QrScanModal.jsx`). Follow existing modal props and state-lifting patterns.
- State: mostly local or small custom stores (e.g., `src/utils/membersStore.js`). Avoid introducing global state libraries unless necessary.

## API & integrations
- Google Apps Script and Sheets integration has been replaced with Firestore for persistent data. Use the Firestore adapter in `src/api/firebase.js` and the client helper in `src/lib/firebase.js`.
  - Local node scripts: `api/` and `scripts/` contain Node utilities and smoke tests (e.g., `scripts/firestore-seed-sample.js`, `scripts/firestore-smoke-test.js`, `api/index.js`). Inspect these before adding ad-hoc scripts.

## Project conventions and gotchas
- File types: React components use `.jsx`; project is ESM (`type: "module"`) so prefer import syntax compatible with Vite.
- Dependencies: `node-fetch` v3 (ESM), `qrcode.react`, `react-window`, `swr` — mind ESM-only modules when writing Node scripts.
- Routing: `react-router-dom` v6 — use the v6 API (hooks: `useNavigate`, etc.).
- Deploy: configured for GitHub Pages — update `vite.config.js` `base` if repo name or path changes.

## Tests & validation
- Tests use `vitest`. Add unit tests under `test/` for small pure functions (see `attendanceUtils.test.js`).

## When modifying data access or integrations
- Prefer updating the existing wrapper functions in `src/api/firebase.js` and `src/lib/firebase.js` instead of adding duplicate network logic.

## Files that often matter during changes
- `src/lib/firebase.js` — Firebase client wrapper for Firestore and Storage.
- (legacy) `src/api/sheets.js` — removed. Use `src/api/firebase.js` for Firestore-backed helpers.
- `src/utils/membersStore.js` — member state logic.
- `src/components/ModalWrapper.jsx` — modal pattern to reuse.
- `apps-script/kusgan/Code.js` — (archived) original Apps Script server code for historical reference.
- `vite.config.js` — change `base` for GitHub Pages.

## What to ask the human
- When adding new persistent data or backend behavior, ask whether it should live in GAS (Sheets) or local scripts (`api/`).
- Ask for design/UX decisions before changing global navigation or page routes.

If anything here is missing or too terse, tell me which area to expand (build, tests, GAS integration, or component patterns).