#!/bin/sh
set -eu

backup_file="${1:-}"
if [ -z "$backup_file" ]; then
  echo "Usage: sh scripts/restore-postgres.sh /path/to/family-app-YYYYMMDD-HHMMSS.sql.gz"
  exit 1
fi

if [ ! -f "$backup_file" ]; then
  echo "Backup file not found: $backup_file"
  exit 1
fi

echo "This restores into the running family_app database."
echo "Stop the app first if you are restoring over existing data."
echo "Press Ctrl+C within 10 seconds to cancel."
sleep 10

gzip -dc "$backup_file" | docker compose exec -T db psql -U family_app -d family_app
