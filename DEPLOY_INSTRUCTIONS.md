# Kusgan API Deployment & Auth Setup

This file explains how to configure the server-side auth (`/auth/login`) so Firestore-backed users work and to allow a safe short-term admin access.

Important: do not enable insecure fallbacks in production. Use `NODE_ENV=production` in prod and only enable the insecure fallback in local/dev for troubleshooting.

## Goal
- Ensure the running API can validate users stored in Firestore: the server must have Firebase Admin (service account) configured OR be provided an `ADMIN_USERNAME` / `ADMIN_PASSWORD` env pair.

## Recommended: Configure Firebase Admin (secure, long-term)
1. Create (or get) a Firebase service account JSON for the project.
2. Provide it to the server in one of these ways (pick one):
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON` — set the raw JSON string as an environment variable.
   - `GOOGLE_APPLICATION_CREDENTIALS_JSON_B64` — set the base64-encoded JSON string as an environment variable.
   - `GOOGLE_APPLICATION_CREDENTIALS` — place the service-account JSON file on the server and point this env var to its path (ensure the runtime user can read it).
3. Restart/redeploy the API process so it can initialize `firebase-admin`.

## Quick short-term: ADMIN_USERNAME / ADMIN_PASSWORD (fast, less secure)
- Set environment variables on your API host:
  - `ADMIN_USERNAME=johannaa`
  - `ADMIN_PASSWORD=JohannaA`
- Restart/redeploy the API. The handler will accept that username/password without Firestore.

## Systemd service example (Linux VPS)
- Copy the service account to `/opt/kusgan/service-account.json` (owner root, readable by service user).
- In the systemd unit, set:
  Environment=GOOGLE_APPLICATION_CREDENTIALS=/opt/kusgan/service-account.json
  Environment=NODE_ENV=production
- Restart:
  sudo systemctl daemon-reload
  sudo systemctl restart kusgan-api

## Docker example
- Mount the JSON as a file or pass base64 JSON via env:
  docker run -e GOOGLE_APPLICATION_CREDENTIALS_JSON_B64="$(base64 -w0 svc.json)" -p 4000:4000 kusgan/api:latest

## CI / GitHub Actions
- Store service account JSON as an encrypted secret (e.g., `KUSGAN_SA_B64`). In deploy job, set `GOOGLE_APPLICATION_CREDENTIALS_JSON_B64: ${{ secrets.KUSGAN_SA_B64 }}` and ensure the runtime reads that env to init admin.

## What to test after deploy
- Test an admin env pair:

```bash
curl -i -X POST https://<API_BASE>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"johannaa","password":"JohannaA"}'
```

- Test a Firestore user (replace fields):

```bash
curl -i -X POST https://<API_BASE>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<username>","password":"<password>"}'
```

Expected: HTTP 200 JSON { ok: true, token, user } if credentials are valid.

## Troubleshooting
- If you get `503: Server not configured for Firestore auth`:
  - The server is in `NODE_ENV=production` and doesn't have admin creds or ADMIN env pair. Either set the service account env or the ADMIN pair and redeploy.
- If you get `401: Invalid username or password`:
  - Check that the `users/<username>` doc exists and has a bcrypt `password_hash` field.

## Security notes
- Never commit service-account JSON into git.
- Avoid enabling `ENABLE_INSECURE_FALLBACK=true` in production.

If you tell me the exact environment that runs your API (systemd/Docker/GCP Cloud Run/Heroku), I can give step-by-step commands tailored to it.
