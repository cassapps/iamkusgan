#!/usr/bin/env bash
# Pull a live SQLite DB from a remote server via scp into api/kusgan.db
# Usage: ./scripts/pull-live-db.sh user@host:/absolute/path/to/kusgan.db
# This script will:
#  - create a timestamped backup of api/kusgan.db (if exists)
#  - copy remote DB to api/kusgan.db
#  - set file permissions to be readable by node
#  - print next steps to restart the API

set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 user@host:/absolute/path/to/kusgan.db"
  exit 2
fi

REMOTE_PATH="$1"
LOCAL_DB="api/kusgan.db"
BACKUP_DIR="api/backups"

mkdir -p "$BACKUP_DIR"

if [ -f "$LOCAL_DB" ]; then
  ts=$(date +%Y%m%dT%H%M%S)
  cp "$LOCAL_DB" "$BACKUP_DIR/kusgan.db.bak.$ts"
  echo "Backed up existing local DB -> $BACKUP_DIR/kusgan.db.bak.$ts"
fi

echo "Copying $REMOTE_PATH -> $LOCAL_DB ..."
scp -C "$REMOTE_PATH" "$LOCAL_DB"

if [ $? -ne 0 ]; then
  echo "scp failed"
  exit 3
fi

chmod 644 "$LOCAL_DB" || true

echo "OK: pulled live DB to $LOCAL_DB"
cat <<EOF
Next steps:
  1) Restart your API server so it picks up the new DB (example):
     cd api && npm run dev
  2) If running on production host, ensure file permissions and ownership are correct.
  3) Test endpoints:
     curl -sS http://localhost:4000/reports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD | jq .
EOF
