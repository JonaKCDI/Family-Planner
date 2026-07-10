# Synology Installation

This folder is the Synology Container Manager handoff bundle. It assumes the full project is copied to:

```text
/volume1/docker/family-app
```

Use this folder as the Container Manager project path:

```text
/volume1/docker/family-app/deploy/synology
```

## 1. Prepare Folders

Create:

```text
/volume1/docker/family-app/expenses
/volume1/docker/family-app/mileage
/volume1/docker/family-app/documents
/volume1/docker/family-app/backups
```

## 2. Configure Environment

Copy:

```text
deploy/synology/.env.example
```

to:

```text
deploy/synology/.env
```

Set:

```env
APP_URL="http://NAS-IP:3000"
APP_PORT="3000"
POSTGRES_PASSWORD="a-long-random-password"
EXPENSE_EXCEL_HOST_DIR="/volume1/docker/family-app/expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
MILEAGE_EXCEL_HOST_DIR="/volume1/docker/family-app/mileage"
MILEAGE_EXCEL_DIR="/data/mileage"
DOCUMENTS_HOST_DIR="/volume1/docker/family-app/documents"
DOCUMENTS_DIR="/mnt/documents"
BACKUP_DIR="/volume1/docker/family-app/backups"
BACKUP_RETENTION_DAYS="30"
BACKUP_TIME="01:00"
TZ="Europe/Berlin"
```

Do not change `POSTGRES_PASSWORD` later unless you also intentionally migrate/reset the database credentials.

After the first admin is created, open **Einstellungen > Notfall-Wiederherstellung** and store a long recovery key offline. If all admins lose access later, open `/admin-recovery`, enter the admin name, recovery key, and a new password. After recovery, replace the key in settings.

## 3. Start In Container Manager

1. Open **Container Manager**.
2. Create a new project.
3. Name: `family-app`.
4. Project path: `/volume1/docker/family-app/deploy/synology`.
5. Compose file: `compose.yaml`.
6. Build and start.

The app container waits for PostgreSQL, runs `prisma migrate deploy`, then starts Next.js.

The document mount is read-only inside the app container (`DOCUMENTS_HOST_DIR:/mnt/documents:ro`). Mount only the narrow folder tree you want the app to read, never a broad root like `/volume1`. After startup, create document roots in the app with paths below `DOCUMENTS_DIR`, for example `/mnt/documents/Familie` or `/mnt/documents/Versicherungen`.

## 4. First App Check

Open:

```text
http://NAS-IP:3000
```

Create the first admin. Then check:

- Login.
- Expense create/edit/delete.
- Excel download/upload.
- Synology Excel export/import.
- Kilometer-Verbrauch exportieren/importieren.
- Task create and status change.
- Contract payment overview.
- Document HTTPS reference.
- Local document root, explorer listing, preview, and download if `DOCUMENTS_HOST_DIR` is mounted.
- Backup file in `/volume1/docker/family-app/backups`.

## 5. HTTPS For iPhone PWA

Preferred setup from `AGENTS.md`:

- Keep the app private on LAN/VPN.
- Use Synology DDNS or another trusted hostname.
- Use DSM certificate management.
- Use DSM Reverse Proxy:

```text
Source: HTTPS your-hostname:443
Target: HTTP 127.0.0.1:3000
```

Then set:

```env
APP_URL="https://your-hostname"
```

Restart the project and install the PWA from iPhone Safari.

## 6. Restore

Restore only when you intentionally want to replace the database contents:

```sh
cd /volume1/docker/family-app/deploy/synology
sh scripts/restore-postgres.sh /volume1/docker/family-app/backups/family-app-YYYYMMDD-HHMMSS.sql.gz
```

Take a fresh copy of the backup file before restoring.

## 7. If The NAS Gets Loud While Idle

The app is designed to stay available, so three containers remain running: the Next.js app, PostgreSQL, and the daily backup helper. Health checks are intentionally lightweight: the app check calls `/api/health` without login or database work, and PostgreSQL is checked once per minute. The backup container sleeps until `BACKUP_TIME`, then creates one compressed database backup and removes old backups.

To diagnose noise before changing safety behavior:

```sh
cd /volume1/docker/family-app/deploy/synology
docker compose ps
docker stats
docker compose logs --tail=80 app db backup
```

In DSM Container Manager, also check CPU, memory, and disk activity per container. If `backup` is active around `BACKUP_TIME`, that is expected. If `db` stays busy all day, check whether another device still has the PWA open or is repeatedly loading the app through the reverse proxy. Avoid disabling health checks or backups until the noisy container is identified.
