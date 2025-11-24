Syncing local with live

This document contains quick-safe steps to copy the live SQLite DB or Firestore export to your local dev environment.

Option A — Live uses SQLite (`kusgan.db` on the server)

1) On your production server (or ask your host): find the path to `kusgan.db`. Example: `/var/www/kusgan/api/kusgan.db`.
2) From your dev machine, run the helper script:

   ./scripts/pull-live-db.sh user@server:/path/to/kusgan.db

   This will backup your local `api/kusgan.db` (to `api/backups/`) and scp the remote DB into `api/kusgan.db`.
3) Restart the API locally and verify:

   cd api
   npm run dev

   curl 'http://localhost:4000/reports/payments?from=2025-11-18&to=2025-11-23' | jq .

Option B — Live uses Firestore (no single sqlite DB)

1) Export Firestore collections to a JSON dump (server-side) using the Firebase Admin SDK or a small Node script, or use `gcloud`/`firebase` commands to export to a GCS bucket.
2) Copy the exported JSON files to your dev machine (gsutil or scp).
3) I can provide a small import script that converts the exported JSON docs into the local SQLite `payments`, `gymEntries`, `members`, and `progress` tables. If you want that, tell me and I will add it to `scripts/`.

Security and notes
- Do not commit production secrets or service account JSON files to the repo.
- When transferring DB files, use secure channels (scp/rsync over SSH).
- Always keep a backup of your local DB before overwriting.
