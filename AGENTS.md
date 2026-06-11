# AGENTS.md

## Project Guidance

- This is a self-hosted family organization app built with Next.js, Prisma, and PostgreSQL.
- Keep the app mobile-first, especially for iPhone-sized screens.
- Prefer overview-first pages. Creation flows should open from the global floating plus button, not occupy permanent page space.
- Preserve user data and avoid destructive changes. Expenses are personal per user; shared areas should keep their family/private visibility model.
- Use clear German UI copy with correct umlauts.
- Use Prisma migrations for schema changes and keep Docker/Synology deployment in mind.
- CSV/Excel-compatible export and import are important safety features for personal expense data.

## Private Synology HTTPS/PWA Setup

- Preferred deployment target is Synology Container Manager behind the user's existing VPN, without exposing the NAS/app to the public internet.
- For a browser-trusted PWA URL, use a Synology DDNS hostname such as `family-name.synology.me` or an app subdomain under it, plus a Let's Encrypt certificate managed by DSM.
- DDNS alone is only name resolution and does not require opening inbound ports. Do not assume port forwarding is acceptable.
- Avoid recommending open router ports, public DSM access, QuickConnect, or public app exposure unless the user explicitly asks for internet access.
- Use Synology DSM Reverse Proxy as the HTTPS endpoint when possible: `https://<synology-ddns-host>` -> `http://127.0.0.1:3000` or the app container port.
- The app/container can stay HTTP internally; the reverse proxy should terminate TLS so iOS/Safari accepts the PWA as a secure origin.
- If DSM can issue/renew the Synology DDNS Let's Encrypt certificate without port 80, prefer that. If it fails and requests HTTP validation, discuss the tradeoff before opening any port.
- For local/VPN use, name resolution must return a reachable Synology LAN/VPN IP. Use local DNS/VPN DNS override if needed, and add a FRITZ!Box DNS rebind exception only when private-IP DNS answers are blocked.
- Keep `APP_URL` aligned with the final HTTPS URL so auth callbacks, service worker scope, and PWA metadata use the trusted origin.

## UI Direction

- Keep layouts dense but calm: compact cards, clear tables/lists, and controls hidden behind intentional actions where appropriate.
- Avoid decorative clutter. Prioritize readable overviews, especially for many expenses, categories, and tasks.
- The floating plus button is the only entry point for creating new expenses, tasks, contracts, and document references.

## Agent Coordination

- 2026-06-11 Codex: Prepared the app for deployment readiness after expense sorting/search, modal cleanup, and contract automation UI work.
  - User goal: make the current app deployment-ready, verify search coverage, automated behavior, bug risk, and Synology deployment safety.
  - User preferences locked in:
    - Expense search should cover all user-visible entry information, not internal IDs.
    - Deployment readiness should include a local Docker/Compose trial run before Synology handoff.
    - Synology deployment should be treated as an update with existing data, so backups and volume preservation are mandatory.
  - Current verified facts:
    - `npm.cmd test` passed: 11 test files, 84 tests.
    - `npm.cmd run lint` passed after fixing React hook and JSX quote blockers.
    - `npm.cmd run build` passed after stopping the local dev server to release the Prisma Windows DLL lock.
    - Localhost was restarted and `/api/health` returned `ok`.
    - Browser smoke test passed for expense search, sort modal, global create modal, contracts with auto-expense/payment signals, and tasks page load.
    - Docker CLI is not available in this Windows environment, so the local Docker/Compose trial run remains the only unexecuted readiness item before Synology handoff.
  - Release blocker status:
    - Lint errors in `src/app/(app)/vertraege/page.tsx` and `src/components/create-modal.tsx` from unescaped JSX quotes are fixed.
    - `src/components/action-modal.tsx` avoids synchronous `setState` inside effects while preserving immediate modal opening for URL-backed modals.
    - `src/components/autosave-form.tsx` avoids synchronous saved-status restoration inside effects.
    - `src/components/period-nav-link.tsx` no longer uses an effect-based pending reset.
    - Stop the local dev server before future `npm.cmd run build` runs if Prisma reports a Windows DLL lock again.
  - Expense search status:
    - `src/lib/expense-search.ts` now searches description, store, payment method, category, label, contract provider/type, kind, currency, amount formats, visible date text/date key, document title/url, fuel/tankstop metadata, recurring series title, and visible auto-contract/auto-fuel labels.
    - Search intentionally does not target internal IDs.
  - Automation status:
    - Existing tests cover contract cancellation/renewal dates, automatic contract expenses, recurring transaction dates, price phase selection, paused/deleted recurring series, recurring task generation, lead times, month-end clamping, leap-year schedules, paused/archived/ended recurring tasks, and stale-plan advancement.
    - Added/verified coverage for price phases split by the "Preis gilt ab" date; generated historical expenses are only updated by the server action when `updateGeneratedExpenses` is checked.
  - Synology deployment safety:
    - Treat deployment as existing-data update.
    - Confirm fresh `.sql.gz` backup before updating.
    - Preserve existing PostgreSQL Docker volume.
    - Use `deploy/synology/compose.yaml`; app waits for DB, runs `prisma migrate deploy`, then starts Next.js via `scripts/docker-entrypoint.mjs`.
    - Verify `APP_URL`, export folders, mileage folders, and backup folder mounts.
    - Run a local Docker/Compose trial with temporary project name and temporary folders before touching Synology once Docker is available.
  - Files touched in this readiness pass: `AGENTS.md`, `src/lib/expense-search.ts`, `tests/expense-search.test.ts`, `tests/contracts.test.ts`, `src/components/action-modal.tsx`, `src/components/autosave-form.tsx`, `src/components/period-nav-link.tsx`, `src/app/(app)/ausgaben/page.tsx`, `src/app/api/expenses/list/route.ts`, `src/app/(app)/vertraege/page.tsx`, and `src/components/create-modal.tsx`.
- 2026-06-10 Codex: Working on dashboard/cockpit rework requested by the user.
  - Scope: time-based greeting, robust finance comparison/signals, direct task completion from cockpit, and dashboard revalidation for task status updates.
  - Expected files: `src/app/(app)/dashboard/page.tsx`, `src/lib/actions.ts`, `src/lib/queries.ts`, and narrowly scoped dashboard styles in `src/app/globals.css`.
  - This overlaps the recurring-tasks work in `actions.ts`, `queries.ts`, and `dashboard/page.tsx`; I will keep edits narrowly scoped and avoid task recurrence code/schema changes.
- 2026-06-10 Codex: Working on recurring tasks and planned tasks requested by the user:
  - Add Prisma models/migration for recurring task plans and generated task links.
  - Add recurrence helpers, due-task generation, server actions, and queries.
  - Extend the global task creation flow and the Aufgaben overview with planned recurring tasks.
  - Add recurrence tests and run test/build verification.
- Expected files for this work: `prisma/schema.prisma`, a new `prisma/migrations/*_recurring_tasks/migration.sql`, `src/lib/tasks.ts`, possibly `src/lib/recurring-tasks.ts`, `src/lib/actions.ts`, `src/lib/queries.ts`, `src/components/create-modal.tsx`, `src/app/(app)/aufgaben/page.tsx`, `src/app/(app)/dashboard/page.tsx`, and `tests/tasks.test.ts`.
- If another agent needs to touch these files, please add a note here first with the intended scope so we can avoid overlapping edits.
- 2026-06-09 Codex: Working on the expenses overview controls requested by the user:
  - Restore quick month/year jump inside the expense filter modal.
  - Arrange `Aktuell`/`Filter` above `Serien`/`Setup` as a compact mobile 2x2 action block.
  - Visually distinguish frequent actions (`Aktuell`, `Filter`) from secondary actions (`Serien`, `Setup`).
  - Regenerate the iOS/apple touch icon from the same visual as `public/icon.svg`.
- Expected files for this work: `src/app/(app)/ausgaben/page.tsx`, `src/components/expense-filter-form.tsx`, `src/components/action-modal.tsx`, `src/app/globals.css`, and `public/apple-touch-icon.png` (possibly `public/icon-192.png`/`public/icon-512.png` if regenerated together).
- If another agent needs to touch the same files, please add a note here first with the intended scope so we can avoid overlapping edits.
- 2026-06-09 Codex: Completed the cockpit finance widget pass.
  - Replace the budget-dependent finance widget with history-based "actual vs normal" signals.
  - Keep the diagram, but make it compare current spending to prior months and a month-end projection.
  - Avoid `src/app/globals.css` because another agent is editing it.
- Expected file for this work: `src/app/(app)/dashboard/page.tsx`.
