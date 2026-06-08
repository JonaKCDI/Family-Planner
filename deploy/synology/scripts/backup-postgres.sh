#!/bin/sh
set -eu

: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${POSTGRES_HOST:=db}"
: "${POSTGRES_PORT:=5432}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=30}"
: "${BACKUP_TIME:=01:00}"
: "${TZ:=Europe/Berlin}"

export PGPASSWORD="$POSTGRES_PASSWORD"
export TZ
mkdir -p "$BACKUP_DIR"

backup_now() {
  timestamp="$(date +%Y%m%d-%H%M%S)"
  target="$BACKUP_DIR/family-app-$timestamp.sql.gz"
  echo "Creating PostgreSQL backup: $target"
  pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$target"
  find "$BACKUP_DIR" -type f -name "family-app-*.sql.gz" -mtime "+$BACKUP_RETENTION_DAYS" -delete
}

seconds_until_backup_time() {
  hour="${BACKUP_TIME%:*}"
  minute="${BACKUP_TIME#*:}"
  case "$hour:$minute" in
    [0-2][0-9]:[0-5][0-9]) ;;
    *) echo "BACKUP_TIME must use HH:MM, for example 01:00." >&2; exit 1 ;;
  esac
  if [ "$hour" -gt 23 ]; then
    echo "BACKUP_TIME hour must be between 00 and 23." >&2
    exit 1
  fi

  now_epoch="$(date +%s)"
  today="$(date +%Y-%m-%d)"
  target_epoch="$(date -d "$today $hour:$minute:00" +%s)"
  if [ "$target_epoch" -le "$now_epoch" ]; then
    target_epoch=$((target_epoch + 86400))
  fi
  echo $((target_epoch - now_epoch))
}

while true; do
  sleep "$(seconds_until_backup_time)"
  backup_now
done
