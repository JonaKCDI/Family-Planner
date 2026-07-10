# Mobile UI Refactoring Plan

Phase 1 inventory for the planned mobile-first UI refactoring. This document describes the current state and an implementation order only. It does not mark planned UI as implemented.

## 1. Aktuelle UI-Architektur

- Next.js App Router with an authenticated app shell in `src/app/(app)/layout.tsx`.
- Global shell: sticky topbar, fixed bottom navigation (`Nav`), central floating plus button (`CreateModal`), global submit indicator, offline sync status.
- Main pages are server components that fetch data directly through query helpers, then render mostly page-local markup.
- Shared client interactions are concentrated in `ActionModal`, `CreateModal`, `SearchableSelect`, `DocumentFilePicker`, `DocumentFilePreview`, `TaskStatusControl`, `PeriodNavLink`, `AutosaveForm`, and `ModalPortal`.
- Global styling is almost entirely in `src/app/globals.css`; it contains base tokens plus several later refresh/correction layers.
- Mobile behavior is CSS-driven with safe-area handling, fixed nav/FAB offsets, modal scroll lock, and responsive list/table transformations.

## 2. Bestehende Design-Primitives

- Tokens: background, foreground, muted, line, panel, accent, danger, plus newer surface/shadow/tap variables.
- Surfaces: `panel`, `card`, `dashboard-card`, `stat`, `setup-card`, `document-row`, `priority-task`.
- Actions: `button`, `button secondary`, `icon-button`, `fab-button`, filter chips, section switchers, status chips.
- Inputs: shared form classes, fieldsets, compact forms, search bars, combobox/searchable select.
- Navigation: topbar brand/actions, fixed `app-nav`, section switchers, document tabs, period navigators.
- Disclosure: native `details/summary` for rows, setup cards, optional form sections, document actions.
- Feedback: empty states, badges, processing overlay, pending form state, offline status.

## 3. Wiederverwendbare Komponenten

- Keep as foundations: `Nav`, `CreateModal`, `ActionModal`, `ModalPortal`, `SearchableSelect`, `DocumentFilePicker`, `DocumentFilePreview`, `GlobalSubmitIndicator`, `TaskStatusControl`, `ExcelProgressPanel`, `PageHeader`, `EmptyState`, `ScopeSelect`.
- Strong candidates for extraction: page search bar, KPI stats grid, section switcher/tabs, period navigator/filter toolbar, expandable list row, row action sheet, modal section tabs, setup/admin section cards, file/document rows, mobile table/stat list.
- Current issue: many reusable patterns exist only as CSS class conventions and repeated JSX.

## 4. Technische Schwachstellen der Mobile-UX

- `globals.css` is too large and layered; later rules override earlier refreshes, increasing regression risk.
- Several pages duplicate the same search/filter/stats/list patterns with local markup.
- Native `details` gives quick disclosure but limits consistent animation, focus handling, and row/action state control.
- Modal and bottom-sheet behavior is close to target, but `ActionModal`, create flow, document picker, and preview are not yet a single sheet system.
- Search/filter interactions vary per page: some use icon submit, some text submit, some modal filter, some tabs.
- Tables still rely on horizontal scroll or local mini-table markup in some analysis sections.
- Console/file text shows possible encoding/mojibake in several German strings; verify actual file encoding before copy polish.
- FAB/nav offsets have accumulated multiple CSS corrections; they need consolidation around a single app-shell contract.

## 5. Komponenten, die erhalten werden sollten

- Global plus as the only create entry point.
- Fixed bottom navigation and safe-area-aware shell.
- Existing create/edit forms and their server actions.
- Document picker/preview security model and local NAS explorer behavior.
- Searchable select combobox behavior.
- Offline expense/task creation hooks and global submit feedback.
- Page-level feature coverage: filters, imports/exports, recurring settings, generated expenses, document root permissions.

## 6. Komponenten, die refaktoriert werden sollten

- `globals.css` into ordered UI layers/modules while preserving class compatibility during migration.
- `ActionModal` and create modal into a shared `Sheet`/`Dialog` primitive with consistent header/body/footer behavior.
- Repeated search bars into a `SearchBar` component.
- Stats into a `MetricGrid`/`MetricCard` component.
- Section switchers/document tabs/status filters into one `SegmentedTabs` primitive.
- Expandable expense/task/contract/mileage/document rows into a common `ExpandableListItem` pattern.
- Page filter toolbars into domain-neutral `FilterToolbar` plus page-specific controls.
- Mini tables into responsive `DataList` or `ResponsiveTable` components.

## 7. Komponenten, die neu benötigt werden

- `AppShell` contract for topbar, content, bottom nav, FAB spacing, and safe-area variables.
- `BottomSheet` primitive shared by create, action modals, filters, sort, picker, preview.
- `IconActionButton` and `ToolbarButton` primitives.
- `MetricCard` and `MetricGrid`.
- `SearchBar` with optional clear/submit icon.
- `SegmentedTabs` / `FilterChips`.
- `ExpandableListItem` with summary, meta, badges, actions, and detail slot.
- `EmptyState`, `LoadingState`, `ErrorState` variants beyond the current simple empty box.
- `ResponsiveDataList` for analysis rows and mobile table replacements.
- Optional `Toast`/inline notice system if future UX requires non-blocking save feedback.

## 8. Vorhandene Funktionen pro Hauptseite

- Cockpit: greeting, monthly finance signals, task quick-complete, next contracts, recent documents, priority strip.
- Aufgaben: search, active/planned/done/all views, stats, expandable task cards, status update, recurring task edit/pause/archive.
- Finanzen: search, month/year/custom period, filters, active filter chips, sort, entries, duplicate review, category/label/period/year analysis, charts, recurring transactions, setup, import/export.
- Auto: search, car picker, month/year/custom period, stats, tankstop list, analysis, setup, Excel import/export, fuel-to-expense defaults.
- Verträge: search, status tabs, stats, expandable contracts, edit modal, price phases, auto-expense settings, payment history, linked documents.
- Dokumente: search, document tabs, saved links/local files, row actions, edit/delete, in-app preview/download, NAS explorer, save file as reference.
- Einstellungen: overview cards, account password, members, recovery key, document roots/access, Synology/deployment facts.

## 9. Ziel-Funktionen, die noch nicht vorhanden sind

- A formal UI system directory with typed primitives.
- One shared bottom-sheet primitive for all modal-like interactions.
- Unified expandable list item component across all domains.
- Unified search/filter/segmented-control component API.
- Unified mobile data-list replacement for all tables.
- Toast-style feedback system.
- Full visual regression coverage for the new shell and sheets.
- Explicit design token files separate from global legacy CSS.

## 10. Risiken für Datenlogik, Sicherheit oder Rechte

- Document routes and picker must keep root-based permission checks, path normalization, symlink blocking, MIME policy, and read-only NAS assumptions untouched.
- Expense visibility and personal-per-user rules must remain query/action behavior, not UI-only filtering.
- Family/private scope controls must continue submitting the same field names.
- Contract auto-expense generation and recurring task generation are triggered in page loads/actions; UI refactors must not move or remove those calls.
- Import/export and Synology actions depend on exact forms/buttons and route targets.
- Modal close/autosave return URLs affect action redirects; refactors must preserve hidden fields and URL modal handling.
- Offline queue behavior for expenses/tasks must preserve current client submit interception.

## 11. Empfohlene Reihenfolge

1. Freeze current behavior with targeted smoke checklist for mobile shell, create flow, filters, row expansion, document preview, imports/exports.
2. Introduce UI primitives behind existing class names: `AppShell`, `BottomSheet`, `Button`, `IconButton`, `MetricGrid`, `SearchBar`, `SegmentedTabs`, `ExpandableListItem`.
3. Refactor global shell and modal system first, keeping routes/actions unchanged.
4. Refactor low-risk overview pieces: stats, search bars, tabs, empty states.
5. Refactor list rows page by page: Aufgaben and Dokumente first, then Verträge/Auto, then Finanzen last.
6. Consolidate filter and period toolbars after row primitives are stable.
7. Split `globals.css` into ordered CSS modules/layers or component CSS while keeping visual parity.
8. Add visual smoke tests for 390px mobile and desktop after each page migration.

## 12. Voraussichtlich betroffene Dateien

- `src/app/(app)/layout.tsx`
- `src/app/globals.css`
- `src/components/nav.tsx`
- `src/components/create-modal.tsx`
- `src/components/action-modal.tsx`
- `src/components/modal-portal.tsx`
- `src/components/searchable-select.tsx`
- `src/components/document-file-picker.tsx`
- `src/components/document-file-preview.tsx`
- `src/components/ui.tsx`
- New files under `src/components/ui/`
- Page markup: `dashboard`, `aufgaben`, `ausgaben`, `kilometer`, `vertraege`, `dokumente`, `einstellungen`
- Visual tests under `tests/visual/`

## Ziel-Funktions-Tabelle

| Ziel-Funktion | Vorhanden | UI-Refactoring möglich | Neue Business-Logik nötig |
|---|---:|---:|---:|
| Mobile-first App Shell | teilweise | ja | nein |
| Feste Bottom Navigation | ja | ja | nein |
| Globales Plus als Erstellungseinstieg | ja | ja | nein |
| Hochwertige Bottom Sheets | teilweise | ja | nein |
| Einheitliche Suche | teilweise | ja | nein |
| Einheitliche Filter | teilweise | ja | nein |
| Einheitliche Expand/Collapse-Listen | teilweise | ja | nein |
| Kompakte KPI-Widgets | ja | ja | nein |
| Einheitliche Tabs/Segmented Controls | teilweise | ja | nein |
| Dokumentvorschau in der App | ja | ja | nein |
| NAS-Dateiauswahl im Create Flow | ja | ja | nein |
| Toasts/Non-blocking Notices | nein | ja | nein, falls nur UI-Feedback |
| Neue fachliche Analysen/Automationen | nein | nein | ja |
| Neue Rechte-/Sichtbarkeitsmodelle | nein | nein | ja |
