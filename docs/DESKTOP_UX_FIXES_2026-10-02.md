# Desktop UX fixes — 2 October 2026

The approved mobile layout and its interactions remain the reference. New visual rules in this pass are scoped to desktop fine-pointer, hover viewports in `src/app/desktop.css`. Existing uncommitted work was preserved.

| Audit finding | Result |
| --- | --- |
| 1. Task and booking sort missing | Fixed. Sort controls are in the visible desktop list headers. |
| 2. Duplicate review missing | Fixed. The desktop booking header exposes the review dialog; its modal ID is distinct from the hidden mobile instance. |
| 3. Detail below fold at 1024 px | Fixed. The list and selected detail retain a compact split view. |
| 4. Period end shown as next day | Fixed for desktop captions by formatting calendar bounds in UTC. |
| 5. Contract NAS link empty | Fixed in the desktop inspector with an authorized file download URL. |
| 6. Category chart and periods cramped | Fixed. Inner analysis stacks until the wide desktop breakpoint. |
| 7. Category selection leaves workspace | Fixed in desktop personal and family analysis. Selection stays on the finance page with period and filter controls. |
| 8. Category pane initially empty | Fixed. The first visible category or label is selected when `selected` is absent or invalid. |
| 9. Create button changes shape or covers content | Fixed. It stays circular and a right-side content gutter reserves its corner. |
| 10. Category income and mixed currency amounts misleading | Desktop analysis labels income and keeps differently denominated historical bookings out of a combined total. The current separate-currency cards are a display choice, not separate accounts or a family-wide currency setting; they need revision to match the intended family currency model. |
| 11. NAS files shown under Links/linked tabs | Fixed. Raw explorer files appear only under All and Files, subject to search. |
| 12. Contract and NAS details incomplete | Fixed. Desktop inspectors show contract auto-expense category, label and update date, and saved NAS path. |
| 13. Unbudgeted category looks fully used | Fixed. Desktop hides the progress bar for categories without a budget. |
| 14. Further Filters label cramped | Fixed with a full-width, two-line desktop disclosure. |
| 15. Dense list scrolling unclear | Fixed with an explicit list-scroll cue and visible scrollbar styling. |
| 16. Booking repeated in inspector | Fixed. The header opens edit and document actions; the record appears once. |
| 17. Empty forecast plots zero history | Fixed. Desktop shows one empty state until recorded months exist. |
| 18. Touch copy and unlabeled desktop actions | Fixed. Desktop uses visible Analysis/Bookings actions and booking-oriented period copy. |
| 19. Settings narrow at 1920 px | Fixed. Desktop settings use the available width with two grouped columns. |

## Verification

- Disposable PostgreSQL databases only; no production or Synology data changed.
- Mobile baseline: 390×844, 430×932 and 844×390, captured before application edits.
- Dense desktop fixture: 25 tasks, 46 bookings, 11 categories, a duplicate pair, income, USD, a NAS root and a linked local contract file.
- Desktop viewports: 1024×768, 1280×720, 1366×900 and 1920×1080.
- Browser checks cover selection, return navigation, period links, filters, sorting, duplicate review, currency display, NAS download, document tabs, create and edit dialogs, plus horizontal overflow and browser errors.
- Final mobile comparison: all 45 screenshots matched the pre-edit baseline pixel for pixel across the three requested viewports.
- `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd test` passed (22 files, 170 tests).
- `npm.cmd run build` passed after the local dev server was briefly stopped to release Prisma's Windows DLL; the server was restarted and `/api/health` returned `ok`. The existing Turbopack document-route tracing warning remains.

## Before and after desktop screenshots

| View | Before | After |
| --- | --- | --- |
| 1024 px task workspace | [Audit](desktop-ux-audit-2026-10-02/compact-tasks.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-compact-tasks.png) |
| 1280 px dense bookings | [Audit](desktop-ux-audit-2026-10-02/laptop-finance-entries-dense.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-laptop-finance-entries.png) |
| 1280 px category analysis | [Audit](desktop-ux-audit-2026-10-02/laptop-finance-analysis-dense.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-laptop-finance-analysis.png) |
| 1024 px category detail | [Audit](desktop-ux-audit-2026-10-02/compact-category-detail.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-compact-category-detail.png) |
| 1024 px filters | [Audit](desktop-ux-audit-2026-10-02/compact-finance-filter.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-compact-finance-filter.png) |
| 1920 px settings | [Audit](desktop-ux-audit-2026-10-02/wide-settings.png) | [Fixed](desktop-ux-fixes-2026-10-02/after-wide-settings.png) |

The disposable fixture also saved [income and mixed currencies](desktop-ux-fixes-2026-10-02/after-laptop-income-currencies.png), [duplicate review](desktop-ux-fixes-2026-10-02/after-laptop-duplicate-dialog.png), and a [contract NAS reference](desktop-ux-fixes-2026-10-02/after-laptop-contract-nas.png).

## Open findings

Finding 10 needs revision after the family currency policy is confirmed. The other 18 desktop findings are closed.

## Scope limit

The pre-existing mobile contract-sheet NAS link remains unchanged because the request prohibited mobile markup and behavior changes. Its desktop inspector link is fixed.

The code-inspection findings were exercised with the disposable fixture and verified after the fixes. The original audit supplied the pre-fix evidence; a separate pre-fix fixture capture was not made before implementation.
