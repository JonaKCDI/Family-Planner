# Implementation Overview

This document is the current product and deployment map for the Family App.

## Stack and Runtime

- Next.js App Router with React server components for the app shell and server actions for mutations.
- Prisma with PostgreSQL as the production database.
- Docker Compose for Synology deployment with `app`, `db`, and `backup` services.
- PWA assets and manifest for iPhone home-screen installation.
- German, mobile-first UI with compact overview pages and creation through the global floating plus button.

## Authentication and Family Model

- First-run setup creates the initial admin user and family.
- Passwords are hashed, and sessions are stored server-side in the database.
- Users belong to a family and can hold roles such as admin/member.
- Records use `PRIVATE` or `FAMILY` visibility where the domain needs it.
- Expense data is intentionally personal per user; shared pages only expose data the current user is allowed to see.

## Cockpit

- The dashboard summarizes open tasks, spending, contract deadlines, and document references.
- Task importance now comes from a shared backend helper used by the dashboard and task page.
- A task is important when it is overdue, due today, marked urgent, high priority with a near deadline, or already in progress with a deadline within seven days.
- Completed and archived tasks are never promoted as important.

## Expenses

- Expenses and income support amount, date, payment method, category, label, visibility, and description.
- Categories and labels include budget values and color coding for analysis.
- Expense filtering supports year, category, label, payment method, and text search.
- Analytics show period totals, category budgets, label budgets, income, spending, and saldo.
- Expenses can be linked to contracts through `contractId`.
- Offline creation is queued in IndexedDB and synced when the PWA is opened again with connectivity.

## Excel Safety Flow

- Legacy text-based import/export has been removed from the active user-facing and backend flow.
- Browser fallback remains available through local `.xlsx` download and upload.
- Synology import/export uses one Excel workbook per user and year in the mounted folder configured by `EXPENSE_EXCEL_DIR`.
- Docker Compose mounts `${EXPENSE_EXCEL_HOST_DIR:-./data/expenses}` to `/data/expenses`.
- The workbook contains one export year. It has a canonical `Daten` sheet for robust round-trip import/export plus readable monthly sheets.
- Excel import/export is a personal expense safety/import feature, not a full database backup.

## Mileage

- The Kilometer tab tracks family-shared cars and fuel/odometer entries.
- Fuel entries store date, odometer, liters, cost, and notes; driven kilometers, l/100 km, €/l, totals, and averages are derived from the car history.
- Active family members can add/edit/delete tank stops. Admins manage cars.
- Mileage Excel import/export uses one all-time workbook per car in the mounted folder configured by `MILEAGE_EXCEL_DIR`.
- Docker Compose mounts `${MILEAGE_EXCEL_HOST_DIR:-./data/mileage}` to `/data/mileage`.

## Tasks

- Tasks support title, description, assignee, priority, due date, status, and visibility.
- Status is controlled through one compact status field again: Offen, In Arbeit, Erledigt.
- The same task importance and urgency helper drives dashboard promotion, task ordering, and task badges.
- Offline task creation and status changes are queued in IndexedDB and synced later.

## Contracts

- Contracts support provider, type, cost, billing interval, start date, optional end date, visibility, and notes.
- `Kündigung spätestens am` stores a reusable yearly month/day deadline independent of payment interval.
- Notice-period fallback calculates `endDate - cancellationNoticeDays` when a concrete end date exists.
- Auto-renewing contracts can roll monthly, quarterly, or yearly from an anchor day; phone-style month-end renewals are supported.
- The contract overview computes the next actionable cancellation deadline at render time, so old stored deadlines do not go stale.
- Linked expenses are shown per contract with totals, recent payments, and a `Mehr laden` control.
- Contract cards can be collapsed or expanded.

## Documents

- Documents are stored as HTTPS references, not uploaded files.
- References can describe Synology Drive/File Station links, WebDAV HTTPS URLs, or external HTTPS sources.
- Documents keep title, type, owner, link, notes, and visibility.
- Synology remains the source of truth for file permissions and content storage.

## Offline and Sync

- The PWA registers a service worker and stores pending changes locally.
- Supported offline mutations include new expenses, new tasks, and task status changes.
- Sync runs when the app is opened, brought to the foreground, or network connectivity returns.
- iOS background sync is not assumed; reopening the installed PWA is the reliable sync trigger.

## Deployment and Backup

- The Docker entrypoint waits for PostgreSQL before starting the app.
- `prisma migrate deploy` runs during container startup.
- The backup service runs `pg_dump | gzip` on an interval and prunes old dumps based on `BACKUP_RETENTION_DAYS`.
- Required deployment folders are the PostgreSQL volume, backup folder, and optional mounted Excel folders.
- Restore uses the generated `.sql.gz` files with `psql` into an empty database.
- Reverse proxy/HTTPS is recommended for external access and for a smooth iPhone PWA experience.

## Removed or Inactive Integrations

- Legacy text-based import/export is no longer part of the active app flow.
- Calendar integration models were removed from the current Prisma schema; historical migrations remain so existing databases can upgrade safely.
- File uploads are intentionally not implemented; document links keep Synology in control of actual files.

## Verification Coverage

- Unit tests cover money parsing, expense analytics, mileage calculations, Excel import/export, contract cancellation schedules, and task importance.
- Production build validates Prisma generation and the Next.js bundle.
- The recommended closure check is `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build`.
