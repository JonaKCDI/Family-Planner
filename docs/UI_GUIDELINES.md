# UI/UX Guidelines

The app should feel like a calm, lightweight, modern private productivity app: quick to scan, useful every day, and never like an admin dashboard.

## Core Rule

Preserve functional depth, reduce visible complexity. If information or controls move out of sight, they must remain reachable through tabs, chips, accordions, row details, overflow actions, or modals.

## Structure

- Start overview-first: primary information before controls.
- Use progressive disclosure: overview -> actions -> details.
- Keep the global floating plus as the creation entry point.
- Summary areas show the strongest 2-4 signals only.
- Repeated content should be compact rows/cards with optional expansion.

## Visual Weight

- Use typography, spacing, alignment, and short copy before adding boxes.
- Reduce large bordered cards, nested containers, strong shadows, heavy all-caps, and large pills everywhere.
- Cards should be near-white with thin low-contrast borders. Shadows belong mainly to floating elements such as modals.
- Secondary controls must not look primary.

## Controls

- Prefer compact search bars: icon/input/clear, Enter submit, optional small submit icon.
- Filters, sort, setup, series, comparison, period mode, and vehicle selection should be compact chips, segmented controls, or small toolbars.
- Keep one primary-looking action per area.
- Preserve hover, pressed, focus, selected, pending, disabled, success, and error states.

## Mobile

- Design for 390px width without horizontal overflow.
- Keep important touch targets around 44-48px.
- Use compact mobile cards/rows; avoid cramped tables.
- Mobile tables should become stacked stat rows/cards.
- Bottom nav should be light; the active tab clear but not a heavy box.
- The FAB should be useful but not visually dominant and must not cover key actions.

## Forms And Modals

- Make create/edit flows feel lighter than system forms.
- Long forms should be grouped into calm sections or step-like areas, e.g. Vertrag / Kosten / Automatik / Dokumente.
- Reduce fieldset heaviness; use compact section headers where feasible.
- Labels and helper text should be smaller and calmer.
- Sticky footers are allowed, but they must not cover fields; close buttons should feel integrated.

## German Copy

Use clear German UI copy with correct umlauts. Keep labels short, concrete, and action-oriented.

## Preservation

Do not break routes, global create flows, imports/exports, document security, NAS/local documents, recurrence, contract automation, generated expenses, settings, document root/access management, or existing visibility rules.

## Planned Mobile UI Refactoring

This section describes the planned structure only; it is not an implementation status.

- Introduce a small UI system under `src/components/ui/` for app shell spacing, bottom sheets, buttons, icon buttons, metrics, search, tabs, chips, expandable list rows, and responsive data lists.
- Keep the global floating plus as the central create entry point and reuse one bottom-sheet primitive for create, edit, filter, sort, picker, and preview flows.
- Refactor page markup gradually: shell and sheets first, then search/stats/tabs, then list rows, then filter toolbars, with Finanzen last because it has the largest surface area.
- Preserve all routes, form field names, server actions, visibility rules, document security checks, import/export behavior, offline hooks, recurrence, and contract automation.
- Use `docs/MOBILE_UI_REFACTORING_PLAN.md` as the Phase 1 inventory and implementation-order reference.

## Phase 2 App Foundation

The app foundation now uses a mobile-first app shell with shared primitives in `src/components/ui-system/`. These primitives must stay free of business logic; pages and server actions keep owning data behavior.

### Tokens

- Background: `--app-background: #fbfaf6`.
- Surfaces: `--surface`, `--surface-subtle`.
- Brand: `--brand`, `--brand-hover`, `--brand-soft`.
- Semantic tones: `--positive`, `--negative`, `--neutral`, `--warning` plus matching soft colors.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`.
- Lines: `--border`, `--border-strong`.
- Radius: controls around 10px, cards around 14px, sheets around 22px, pills fully rounded.
- Shadows stay subtle, normally `0 2px 10px rgba(20, 35, 30, 0.04)`.

### Typography

- Use a system sans-serif stack.
- Page titles: about 24-28px, semibold.
- Section titles: about 16-18px, semibold.
- Card titles: about 14-16px, semibold.
- Body text: about 13-15px.
- Metadata: about 11-12px.
- Money, dates, distances, consumption values, and KPI numbers should use tabular numerals where possible.

### Spacing

- Use the app spacing scale: 4, 8, 12, 16, 20, 24, 32px.
- Mobile page padding should stay near 16px.
- Dense views are allowed, but repeated rows need enough vertical touch space.

### App Shell

- The authenticated app shell is composed of `AppShell`, `AppHeader`, `AppMain`, `BottomNavigation`, and the existing global create modal.
- Header, content, bottom navigation, and floating plus must all account for safe areas.
- Main content needs bottom padding so the bottom navigation and plus button do not cover the last interactive controls.
- Desktop remains centered with a compact app feel instead of stretching content across the full viewport.

### Header

- Keep the header compact: app icon, app name, family/user context, settings, and logout.
- Header should feel like app chrome, not website navigation.
- Icon actions need clear `aria-label` values and about 40-44px touch targets.

### Navigation

- Mobile uses a persistent bottom navigation with icon plus short label.
- Inactive tabs use muted text; the active tab uses brand color and a soft brand icon background.
- Desktop keeps the same compact bottom navigation centered to preserve the mobile-first architecture.

### Global Plus

- The global plus remains the central create entry point.
- It should be circular, 52-56px, brand colored, above bottom navigation, and never obscure key page actions.
- Pressed and focus states must be visible but calm.

### Responsive Ground Rules

- Mobile: one column, 16px page padding, two-column compact metric cards, no page-level horizontal scroll.
- Tablet: allow two-column content where it improves scanning.
- Desktop: keep content around 1180-1280px max width and preserve the compact app character.
- Respect `prefers-reduced-motion`.

## Phase 3 Interaction Primitives

Shared interaction primitives live in `src/components/ui-system/interactions.tsx` with styles in `src/components/ui-system/interactions.css`. They should be adopted gradually by page-level UI without changing form fields, server actions, route semantics, or permissions.

### Bottom Sheets And Modals

- Use `BottomSheet` for reusable mobile sheets and desktop modals.
- Mobile sheets enter from the bottom, keep rounded top corners, lock page scroll, and keep header/body/footer structurally separate.
- Desktop sheets appear as centered modals with a constrained width and internally scrollable body.
- Header and footer should stay visible while the body scrolls.
- Escape, backdrop, and close button all close through the same controlled state.
- Focus must move into the sheet, remain trapped while open, and return to the opener on close.

### Form Controls

- Prefer `FieldShell`, `TextInput`, `TextArea`, `SelectInput`, and `Toggle` for new UI-system forms.
- Existing forms may keep native controls during migration, but should preserve 42-48px height, small labels, clear focus, and inline error text.
- Required fields should be visible in the label, not only implied by browser validation.
- Field components must not duplicate server-side validation or security checks.

### Segmented Controls And Tabs

- Use `SegmentedControl` for 2-4 compact modes.
- Use `SheetTabs` for form sections inside sheets, such as Details, Optionen, Dokument, or Quelle.
- Selected states should be obvious through brand color and text contrast.
- Controls must stay keyboard reachable.

### Search Pattern

- Use the disclosure-style search pattern when a page needs a calmer header: a compact search trigger opens the actual search form without causing a large layout jump.
- The search form itself must keep using the existing GET parameters and server-side filtering.
- Enter submits the existing search. Clear/close controls should be visually obvious.

### Filter Pattern

- Filters should open in a `BottomSheet`.
- Use `FilterSheetLayout` and `FilterGroup` for grouped controls, reset actions, apply actions, and active filter summaries.
- Do not invent new filter parameters during visual refactors.

### Expandable List Items

- Use `ExpandableListItem` as the target pattern for tasks, bookings, tank stops, contracts, and documents.
- Collapsed state should contain title, key metadata, status/value, and a generous touch target.
- Expanded state may show details, metadata, edit actions, and context actions.
- Animate only the detail area and respect reduced motion.

### Overflow Menus

- Use `OverflowMenu` for contextual actions such as Vorschau, Download, Bearbeiten, or Löschen.
- Show only actions that are already allowed and available in that context.
- Mobile action-sheet behavior can be layered on later without changing action semantics.

### States

- Use `LoadingState`, `InlineError`, and `SuccessFeedback` for new shared UI.
- Loading states should mirror the eventual layout where practical.
- Errors and success messages must not rely on color alone.

### Animation And Accessibility

- Microinteractions should stay around 120-180ms; sheet transitions around 200-280ms; expand transitions around 160-240ms.
- Prefer `transform` and `opacity`.
- Avoid decorative motion that delays input.
- Respect `prefers-reduced-motion`.
- Maintain visible `focus-visible` states, aria labels for icon-only actions, and sufficient contrast.

## Phase 4 Cockpit And Tasks

### Cockpit Composition

- The cockpit starts with a compact personal greeting, then four mobile 2x2 metric widgets.
- Follow the order: greeting, status metrics, next tasks, finance, cancellation deadlines, vehicle consumption, supporting documents.
- Use only existing values and helpers for finance, tasks, contracts, and mileage. Missing data should become an empty state or a short prerequisite note, not a fabricated KPI.
- Keep the global plus as the create entry. On cockpit it opens the existing create selection in one shared bottom-sheet flow.

### Semantic Widget Tone

- Use soft semantic tones for metrics: negative for overdue/exceeded, warning for attention, positive for calm/complete, neutral for projections or informational values.
- Status must be readable as text, not only color.
- Compact charts are allowed when based on existing calculations; avoid decorative charts that do not add a decision signal.

### Task List Pattern

- Tasks use compact expandable rows with a narrow urgency accent, title, due date/person/priority metadata, and a status badge in the collapsed state.
- Expanded rows contain description, scope/repetition metadata, existing safe status actions, and the existing edit flow.
- Search, filters, and sorting stay URL-driven and server-rendered. Do not introduce new task semantics while refactoring visuals.
- Task create and edit forms use bottom-sheet presentation with Details and Weitere Optionen sections while preserving field names and server actions.

### Cockpit Create Sheet

- The cockpit create sheet lists only existing creation flows: Buchung, Tankstopp, Aufgabe, Vertrag, Dokument.
- Selecting a type transitions inside the same sheet instead of stacking overlays.
- New create types or document automation must be documented separately before implementation.
