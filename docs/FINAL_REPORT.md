# Final Report

This is the deployment-closure report for the Family App. It reflects the current implementation after the Excel-only flow, contract payment tracking, PWA/offline work, branding pass, and pre-deployment security hardening.

## What The App Can Do

The app is a self-hosted, mobile-first family organization PWA built with Next.js, Prisma, and PostgreSQL. It is designed for private Synology deployment, preferably behind LAN/VPN access and optionally behind DSM Reverse Proxy with HTTPS for iPhone home-screen installation.

Implemented modules:

- **Setup and login:** first-run setup creates the family and first admin. Later admins can add family members.
- **Cockpit:** overview of current spending, important tasks, contracts, and documents.
- **Expenses:** personal income/expense tracking per user, with categories, labels/projects, payment method, search, filters, budget analysis, and yearly/monthly views.
- **Excel safety flow:** local browser `.xlsx` download/upload plus Synology-mounted Excel import/export, one workbook per user and year.
- **Tasks:** family/private tasks with assignee, priority, due date, single status control, important-task logic, and offline creation/status changes.
- **Contracts:** provider, contract type, cost, payment interval, status, yearly cancellation date, cancellation notice, auto-renewal, linked expenses, payment overview, load more, and collapse/expand.
- **Documents:** HTTPS-only references to Synology Drive/File Station, WebDAV, or external URLs. The app stores links, not files.
- **Offline/PWA:** service worker, manifest/icons, IndexedDB queue for new expenses, new tasks, and task status changes.
- **Settings/Synology panel:** admin-only deployment facts for APP_URL, Excel folder, backup plan, and database state.

## How To Use It

1. Open the app URL.
2. On first launch, create the family and first admin.
3. Use the global floating plus button to create expenses, tasks, contracts, and document references.
4. Use **Ausgaben > Setup** to manage categories, labels, and Excel import/export.
5. Use **Verträge** to review costs, cancellation deadlines, auto-renewing contracts, linked payments, and documents.
6. Use **Aufgaben** for task planning; important tasks are promoted when overdue, due today, urgent, high-priority with a near deadline, or in progress with a near deadline.
7. Use **Dokumente** for HTTPS references to files managed outside the app.
8. Use **Einstellungen** as admin to add family members and verify Synology/deployment values.

## Privacy And Security Readiness

- Expenses are personal for reads, writes, deletes, Excel import/export, and sync. Admins cannot delete another user’s expenses.
- Submitted relation IDs are re-authorized server-side before writes.
- Offline sync create no longer upserts blindly into existing IDs. Existing IDs must belong to the current user/family or the sync change fails.
- Document links are validated against visible/current-user entities; general documents clear the linked entity ID.
- Authenticated HTML pages are not precached by the service worker. Offline data lives in IndexedDB and is cleared on logout.
- Login throttling locks a username for 15 minutes after 5 failed attempts.
- New passwords require at least 10 characters.
- Expired sessions are cleaned up opportunistically.
- Docker runs the app as a non-root user, and PostgreSQL is not published directly by Compose.

## Backup Model

There are two separate safety layers:

- **PostgreSQL backup:** the real full-system backup. The `backup` service writes compressed SQL dumps like `family-app-YYYYMMDD-HHMMSS.sql.gz`.
- **Excel export/import:** personal expense safety and portability, not a database backup.

Before applying migrations to a database with real calendar data, take a SQL backup. The old calendar migration now archives old calendar tables before dropping them when those tables exist, but backup remains the source of truth.

## Installation Summary

Recommended Synology target:

- Synology Container Manager.
- Full project copied to `/volume1/docker/family-app`.
- Dedicated install bundle in `deploy/synology`.
- Private LAN/VPN access first: `http://NAS-IP:3000`.
- Optional iPhone/PWA HTTPS via DSM Reverse Proxy and Synology DDNS.

Essential folders:

```text
/volume1/docker/family-app
/volume1/docker/family-app/expenses
/volume1/docker/family-app/backups
```

Essential environment values:

```env
APP_URL="http://NAS-IP:3000"
APP_PORT="3000"
POSTGRES_PASSWORD="long-random-password"
EXPENSE_EXCEL_HOST_DIR="/volume1/docker/family-app/expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
BACKUP_DIR="/volume1/docker/family-app/backups"
BACKUP_RETENTION_DAYS="30"
BACKUP_INTERVAL_SECONDS="86400"
```

Detailed installation files are in `deploy/synology/`.

## Final Verification Commands

Run before deploying:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

If `npm.cmd run build` fails on Windows with a Prisma DLL `EPERM` rename error, stop the local dev server, rerun the build, then restart the dev server if you still need local testing.

Current local verification:

- `npm.cmd run lint` passed.
- `npm.cmd run test` passed: 6 test files, 36 tests.
- `npm.cmd run build` passed after stopping the local dev server that had locked Prisma's Windows DLL.
- Local migration deploy applied `20260516190000_login_attempts`.
- Browser smoke check loaded the authenticated app pages on `http://localhost:3000`; `/vertraege` rendered the fixed contract title row and `/aufgaben` rendered the single status selects.
- `docker compose config` could not be run on this Windows machine because Docker is not installed/in PATH here; run it on the Synology or another Docker host before the first deployment.
