---
version: alpha
name: Family Planner
description: Clear, rounded and friendly design system for a self-hosted family organization app.
colors:
  primary: "#0F766E"
  primary-hover: "#0B625C"
  primary-soft: "#E6F3F1"
  on-primary: "#FFFFFF"
  background: "#F6F7F8"
  surface: "#FFFFFF"
  surface-subtle: "#F2F4F5"
  surface-muted: "#EAEEF0"
  text-primary: "#17201F"
  text-secondary: "#66736F"
  text-muted: "#66736F"
  border: "#DDE3E4"
  border-strong: "#C9D1D2"
  positive: "#176B41"
  positive-soft: "#E9F5EE"
  negative: "#A83232"
  negative-soft: "#FBEAEA"
  warning: "#8A4E0E"
  warning-soft: "#FFF3E2"
  info: "#245FAD"
  info-soft: "#EAF2FC"
  violet: "#684AAE"
  violet-soft: "#F0ECFA"
  overlay: "rgba(23, 32, 31, 0.42)"
typography:
  page-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 24px
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: -0.02em
  section-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 17px
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: -0.01em
  card-title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: 620
    lineHeight: 1.35
  body-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
  label-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 550
    lineHeight: 1.3
  metadata:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 12px
    fontWeight: 450
    lineHeight: 1.35
  metric-lg:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 26px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.02em
    fontFeature: "tnum"
  metric-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 18px
    fontWeight: 680
    lineHeight: 1.2
    fontFeature: "tnum"
rounded:
  xs: 6px
  sm: 10px
  md: 12px
  lg: 16px
  sheet: 20px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  mobile-gutter: 16px
  desktop-gutter: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  icon-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: 44px
    width: 44px
  fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: 56px
    width: 56px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  card-subtle:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: 16px
  surface-muted:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  metadata-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-muted}"
    typography: "{typography.metadata}"
  divider:
    backgroundColor: "{colors.border}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.border-strong}"
    height: 1px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 12px
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 10px
  chip-inactive:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.full}"
    height: 36px
    padding: 10px
  avatar:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: 28px
    width: 28px
  bottom-sheet:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sheet}"
    padding: 16px
  overlay:
    backgroundColor: "{colors.overlay}"
    textColor: "{colors.on-primary}"
  status-positive:
    backgroundColor: "{colors.positive-soft}"
    textColor: "{colors.positive}"
    rounded: "{rounded.full}"
  status-negative:
    backgroundColor: "{colors.negative-soft}"
    textColor: "{colors.negative}"
    rounded: "{rounded.full}"
  status-warning:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.full}"
  status-info:
    backgroundColor: "{colors.info-soft}"
    textColor: "{colors.info}"
    rounded: "{rounded.full}"
  status-violet:
    backgroundColor: "{colors.violet-soft}"
    textColor: "{colors.violet}"
    rounded: "{rounded.full}"
---

# Family Planner Design System

## Overview

Family Planner is a self-hosted, mobile-first household and family organization app. It combines tasks, finances, vehicles, contracts and documents without feeling like an enterprise administration system.

The product should feel like a **clear, rounded and friendly everyday helper**:

- adult and high quality, but not like a professional banking app;
- precise and geometric, but not sterile;
- calm and compact, but not empty;
- personal, but not childish;
- useful offline and locally hosted without depending on external visual services.

The interface uses neutral light surfaces, a controlled petrol brand color, consistent rounding, local outline icons and restrained semantic accents. Functionality is revealed progressively: overview first, then details, editing and setup.

Written rules in this file define behavior and information architecture. Approved mockups define proportion, hierarchy and atmosphere. If a generated mockup contains an obvious text, value, icon or alignment error, this file takes precedence.

### Product principles

1. **Daily usefulness first.** Show what needs attention before showing administration.
2. **Overview before controls.** Filters and setup must not dominate the first viewport.
3. **Progressive disclosure.** Keep quick actions short; move optional fields and rare actions deeper.
4. **One interaction layer.** Never stack sheets or modals.
5. **Local by design.** Icons, avatars and core visuals work without internet access.
6. **Same app everywhere.** Mobile and desktop share components and the circular global plus button.
7. **Functionality is preserved.** Visual refactoring must not silently remove routes, fields, permissions, automations, offline hooks or import/export flows.

## Colors

The palette is neutral and crisp rather than warm, botanical or paper-like.

- **Primary (`#0F766E`):** Petrol for active navigation, primary actions, selection and the global plus button.
- **Background (`#F6F7F8`):** Neutral very light gray. Avoid cream or yellowed off-white.
- **Surface (`#FFFFFF`):** Primary cards, rows, inputs and sheets.
- **Text primary (`#17201F`):** Dark charcoal; never pure black where avoidable.
- **Text secondary (`#66736F`):** Metadata, helper text and secondary labels.
- **Border (`#DDE3E4`):** Fine cool-gray separation.
- **Positive (`#238653`):** Income, remaining budget and improvements.
- **Negative (`#C44747`):** Expenses, deficits and destructive feedback.
- **Warning (`#C97922`):** Upcoming deadlines and near-limit budgets.
- **Info (`#3979C8`):** Neutral information and explanatory insights.
- **Violet (`#8067C8`):** Restrained additional category differentiation.

Semantic colors always appear with text, icons, labels or numbers. Never communicate status using color alone.

Category and label colors may vary, but must come from a controlled local palette. Avoid rainbow-like distribution and ensure adjacent chart colors remain distinguishable.

### Decorative color use

Selected widgets may use very pale semantic or category tints. Do not use dark finance hero cards, glossy gradients or a different pastel background on every card.

## Typography

Use the local system sans-serif stack. No webfont is required for the app to feel complete, and the design must not depend on an external font request.

- **Page titles:** compact, 24px, semibold/bold.
- **Section titles:** 17px, semibold.
- **Card titles:** 15px, semibold.
- **Body:** 14px with calm line height.
- **Metadata:** 12px, visually secondary but readable.
- **Metrics:** 18–26px with tabular numerals.

Use sentence case. Avoid decorative uppercase, handwritten fonts, handwriting-like accents and excessive font weights.

Money, dates, odometer readings, liters, percentages and consumption values should use tabular figures.

## Layout

### Mobile reference

- Primary design viewport: `390 × 844 px`.
- Page gutter: 16px.
- Spacing scale: 4, 8, 12, 16, 20, 24 and 32px.
- One primary content column.
- Compact two-column metric layouts are allowed.
- No page-level horizontal scrolling.
- Bottom content padding must account for safe area, navigation and the FAB.

All comparison mockups must use phones of identical width, height and scale. Header, content top, bottom navigation and FAB must align exactly.

### Desktop strategy

Desktop is functionally closer to the current `main` implementation than mobile. Do not rebuild it merely as enlarged mobile UI.

- Preserve direct access to filters, analysis and setup where useful.
- Use a responsive widget grid with different spans rather than stretching mobile cards.
- Tables may remain tables when they improve desktop scanning.
- Detail panels may use master-detail layouts.
- The circular global plus button remains unchanged as a product identity element.
- User-configurable widget placement is a possible later feature, not assumed by this design system.

Desktop visuals are less final than mobile. When uncertain, preserve current functionality and reuse tokens/components without inventing a new navigation model.

### Density

Prefer compact rows and clearly grouped sections over large nested cards. Use whitespace and dividers before creating another container.

## Elevation & Depth

Depth comes primarily from tonal surfaces and borders.

- Cards: white on light-gray background with a fine border.
- Resting shadows: absent or extremely subtle.
- Floating elements: modest shadow only for FABs, sheets and desktop dialogs.
- Backdrop: neutral dark translucent overlay.

Do not use multiple competing elevation levels on one mobile screen. Avoid glassmorphism and blurred translucent cards.

## Shapes

The shape language is clear, geometric and consistently rounded.

- Cards: 14–16px radius.
- Inputs and buttons: 12–14px radius.
- Sheets: about 20px on top corners only.
- FAB and avatars: circular.
- Pills: only for compact status/filter controls, not every label.

Decorative motifs, if used, are precise geometry: cropped arcs, quarter-circles, dot grids, line segments or restrained microcharts. Never use plants, leaves, suns, hand-drawn doodles, organic branches or paper textures.

## Components

### App header

Mobile header structure is fixed:

- left: small petrol rounded-square home/app mark;
- middle: `Familien-App` and context `Familie · Nutzer`;
- right: settings icon in a subtle outlined square;
- no mobile logout icon.

The header has identical dimensions across all main pages.

### Bottom navigation

Exactly six mobile destinations:

1. Cockpit
2. Aufgaben
3. Finanzen
4. Auto
5. Verträge
6. Dokumente

Active state: petrol icon/text with a thin underline or very subtle tint. Do not create a large active tile. Settings is outside the six primary destinations; no bottom item is active on the settings page.

### Global floating action button

The global plus button is a cross-platform identity element:

- exactly 56 × 56px;
- circular petrol surface;
- white plus only, no domain icon;
- fixed 16px from the right edge;
- fixed 16px above mobile bottom navigation;
- identical position on every main page;
- must not cover key content.

When a sheet is open, hide the FAB. The sheet owns its own close control.

Settings has no FAB because it is not a general creation context.

### Search

Search is collapsed by default on tasks, finances, vehicles, contracts and documents.

- Default: magnifying-glass icon in the title row.
- Activated: title area becomes a full-width search input with autofocus and an X.
- Filter remains available.
- Closing restores the title without losing unrelated page state.
- Cockpit and settings do not require global search.

Do not place a permanent large search field on overview screens.

### Filter

Filter icon opens one reusable bottom sheet. An active search may be summarized as context, e.g. `Aktive Suche: Rewe`, but is not duplicated as another field.

Filter footer uses `Zurücksetzen` and either `Filter anwenden` or a reliable result count such as `24 Einträge anzeigen`.

### Tabs and segmented controls

Use borderless text tabs with a thin petrol underline for page sections:

- Übersicht / Analyse;
- finance analysis subsections;
- Tankstopps / Analyse / Jahresvergleich;
- Aktiv / Beendet;
- Gespeichert / NAS-Dateien.

Use segmented controls only for small fixed mode sets:

- Ausgabe / Einnahme;
- Monat / Jahr;
- All / expense / income where appropriate;
- one-time / recurring creation modes.

Do not wrap every navigation level in a boxed segmented control.

### Period navigation

Period controls are separate from page-section navigation and filtering:

- previous/next chevrons;
- central period label, e.g. `Juli 2026` or `2026`;
- compact `Monat | Jahr` mode.

The selected period persists when moving between finance overview and analysis.

### Cards and rows

- Use cards for summaries, insights and meaningful grouping.
- Use rows for repeated tasks, transactions, contracts, documents and tank stops.
- Avoid nested cards.
- Repeated rows contain leading icon/avatar, primary text, compact metadata, trailing value/status and optional chevron/overflow.
- Whole-row tap targets should be generous.

### Initial avatars

Do not require profile photos.

- Use 24–28px circular initial avatars in lists.
- Assign each member a stable color from a small local palette.
- Always show the person's name as text.
- Avatar color is for recognition, not identity by itself.

### Local icon registry

Use one locally bundled outline icon family. Never fetch icons or logos from the internet.

- Store stable string keys, not SVG markup or external paths.
- Map keys to explicitly imported local components.
- Use a neutral `tag`/document fallback for unknown keys.
- Pair every icon with text.
- Do not display provider logos such as Netflix or Congstar.

Category examples: `car`, `plane`, `utensils`, `shopping-basket`, `receipt`.  
Contract examples: `smartphone`, `play-square`, `shield-car`, `wifi`, `zap`, `home`.  
Document examples: `file-pdf`, `sheet`, `link`, `folder`, `file`.

Category icon selection is a curated, searchable list of roughly 40–60 local icons. The final option is `+ Neues Symbol` only if custom icons are actually supported; otherwise users select from the registry.

### Category appearance

A category appearance combines:

- stable icon key;
- controlled color key;
- visible category name.

The app may suggest an icon locally based on German category-name synonyms, but the user confirms or changes it. No AI or internet is required.

### Comboboxes and dropdowns

Use dropdown/searchable combobox patterns for long or extensible selections:

- category;
- payment method;
- label/project;
- contract;
- source;
- billing rhythm;
- assignee where useful.

Closed state is the standard in package overview mockups:

```text
Kategorie
[ Icon  Restaurant                         ▾ ]
```

Down-chevron means selection. Right-chevron means moving to another workflow step.

An opened picker remains inside the current sheet context and may provide search plus `+ Neu hinzufügen`. Quick Add transitions the same sheet to a subview; never stack another sheet. Returning preserves the parent form. The new value is selected automatically after creation.

Payment method is currently string-based. Existing values may be suggested from data, and users may enter a new string without implying a new central database model.

### Bottom sheets

Mobile sheets:

- attach flush to the bottom edge;
- round only top corners;
- include a subtle drag handle;
- use one X close button;
- optionally show a back arrow for multi-step flows;
- dim and lock the background;
- disable bottom navigation;
- hide the FAB;
- trap focus and return it to the opener on close.

Within one package, comparable sheets should share approximately the same outer height and aligned header/footer baselines. Long content scrolls internally. Do not show detached floating modal cards or stacked sheets.

### Sheet forms

Fast-create forms show only the most important fields. Optional fields live under `Weitere Optionen`.

- Labels remain visible and short.
- Required fields are marked.
- Errors appear inline and preserve values.
- Sticky footer retains primary/secondary actions.
- Pending state prevents duplicate submits.
- Keyboard must not cover fields or actions.

### Status and feedback

Status uses text plus color/icon. Destructive actions belong in overflow menus or confirmation flows, never as the default primary action.

## Do's and Don'ts

### Do

- Do use the neutral background and white surfaces consistently.
- Do use petrol for navigation, selection and primary action.
- Do keep main controls aligned at the same Y positions across related screens.
- Do show one or two meaningful geometric micro-highlights per viewport at most.
- Do keep repeated information in compact rows.
- Do preserve all existing functional paths during visual refactoring.
- Do use local icons, initial avatars and system fonts.
- Do validate at 390 × 844px and against iPhone safe areas.
- Do preserve URL-driven filters and server-side permissions.
- Do use textual explanations for financial insights.
- Do maintain WCAG AA contrast and visible focus states.

### Don't

- Don't use cream/yellowed paper backgrounds.
- Don't use plants, leaves, suns, handwriting or organic doodles.
- Don't make the app look like fintech, trading software or an enterprise admin dashboard.
- Don't use dark finance hero cards or stock charts.
- Don't use provider/brand logos or external icon services.
- Don't leave search permanently expanded by default.
- Don't mix search and filter into competing simultaneous inputs.
- Don't stack sheets or leave the FAB visible behind an open sheet.
- Don't place every element in a pill or card.
- Don't create giant button/filter matrices.
- Don't communicate meaning using color alone.
- Don't add new business logic merely to satisfy a generated mockup.
- Don't append another unordered override layer to an already historical global CSS file.

## Information Architecture

### Global menu structure

```text
Family Planner
├── Cockpit
├── Aufgaben
│   ├── Übersicht
│   ├── Suche
│   ├── Filter
│   ├── Aufgabe erstellen
│   ├── Aufgabendetails
│   └── Wiederkehrende Aufgaben
├── Finanzen
│   ├── Übersicht
│   │   ├── Monat
│   │   └── Jahr
│   ├── Analyse
│   │   ├── Kategorien
│   │   ├── Budgets
│   │   ├── Labels
│   │   └── Vergleich
│   ├── Einträge
│   ├── Suche und Filter
│   ├── Buchung erstellen
│   ├── Buchungsdetails
│   ├── Wiederkehrende Buchungen
│   └── Setup / Import / Export
├── Auto
│   ├── Fahrzeugauswahl
│   ├── Tankstopps
│   ├── Analyse
│   ├── Jahresvergleich
│   └── Fahrzeug- und Excel-Setup
├── Verträge
│   ├── Aktiv
│   ├── Beendet
│   ├── Filter einschließlich Entwürfe
│   ├── Vertragsdetails
│   ├── Preisphasen
│   └── Automatische Ausgaben
├── Dokumente
│   ├── Gespeichert
│   │   ├── Alle
│   │   ├── Lokale Dateien
│   │   └── Links
│   ├── NAS-Dateien
│   ├── Vorschau / Download
│   └── Verknüpfungen
└── Einstellungen
    ├── Personal
    │   └── Eigenes Passwort
    ├── Familie
    │   ├── Haushaltsmitglieder
    │   └── Rollen und Zugriffe
    ├── Dokumente
    │   ├── Dokumentenablagen
    │   └── NAS-Zugriffsrechte
    └── System
        ├── Synology und Speicher
        ├── Notfall-Wiederherstellung
        └── Offline und Synchronisierung
```

The settings icon in the global header opens settings. Logout is not a mobile header action; it belongs in settings/account context. Desktop may retain direct logout if appropriate.

## Screen Specifications

### Cockpit

Purpose: answer what needs attention now and provide a compact monthly status.

Order:

1. greeting and one-line helper copy;
2. compact 2×2 metrics: income, expenses, balance, open tasks;
3. `Als Nächstes` task rows;
4. recent activities and deadlines;
5. global navigation and FAB.

The cockpit is not finance-dominated. It balances tasks, deadlines and recent activity.

### Tasks overview

- Title with collapsed search/filter.
- Compact filters: All, Open, Today, Overdue, Planned.
- Small status summary, not four giant cards.
- Prioritized tasks first, planned tasks after.
- Rows show check/status, title, initial avatar/name, date and priority/status text.
- Near-due task uses restrained warning tint.

### Finance overview

- `Übersicht | Analyse` is borderless text navigation with underline.
- Period controls remain separate.
- Overview shows income, expenses, balance and remaining budget.
- Category preview and recent transactions follow.
- `Detaillierte Analyse ansehen →` moves to analysis without looking like a large primary button.

### Finance analysis

Shared subsections:

- Kategorien
- Budgets
- Labels
- Vergleich

Prefer horizontal bars, progress bars and explanatory insights over dominant pie charts.

#### Categories

- Total spending for selected period.
- Rows with local icon, name, amount, share and delta.
- Helpful insight such as `Auto ist diesen Monat deine größte Kategorie.`

#### Budgets

- Overall monthly budget, spent and remaining.
- Category rows show budget, spending and explicit remaining/exceeded text.
- `Ohne Budget` is a valid state.
- `Budgets verwalten →` opens management.

#### Labels and projects

- Cross-category project/travel groupings.
- Row/card shows label name, budget, spent, remaining, date/context and visibility/owner.
- Examples: Munich KW28, Urlaub, Wohnung Hamburg.
- `Labels verwalten →` opens management.

#### Comparison

- Year mode with closed `Jahr A` and `Jahr B` dropdowns.
- High-level totals and signed difference.
- Category comparison rows show both values and difference.
- Explain the largest changes in plain language.
- Avoid market/trading visual metaphors.

### Auto overview

- Collapsed search/filter.
- Compact car selector.
- Period navigation.
- Summary: fuel costs, liters, distance and average consumption.
- Borderless sections: Tankstopps, Analyse, Jahresvergleich.
- Tank-stop rows show date, odometer, amount, liters and derived consumption.

### Contracts overview

- Collapsed search/filter.
- Primary tabs only `Aktiv` and `Beendet`.
- `DRAFT` remains available through filter; do not remove its business state.
- Summary: active normalized monthly cost, count and next cancellation.
- Use generic local contract-type icons, never provider logos.
- Upcoming cancellation uses warning text and tint.

### Documents overview

- Collapsed search/filter.
- Primary tabs: Gespeichert and NAS-Dateien.
- Saved-source filter: All, local files, links.
- Rows show file/link icon, title, type, source, metadata and overflow.
- Local mounted NAS files and HTTPS references are both valid sources.
- Unavailable file remains visible with a neutral status; do not delete automatically.
- Never expose absolute NAS paths.

### Settings overview

Settings is grouped navigation rather than a long form:

- account summary with initial avatar, role and family;
- personal;
- family;
- documents;
- system.

Technical environment values appear one level deeper. Settings has no FAB.

## Interaction Flows

### Task creation

```text
Tasks → FAB → Global New → Task
→ choose One-time or Recurring
```

One-time quick fields: title, due date, assignee and note. Priority and visibility live under further options.

Recurring flow uses one sheet with two steps:

```text
Details → Wiederholung → Serie speichern
```

Back preserves values. Recurrence only exposes rules supported by the actual data model. Lead time is worded as `Aufgabe anzeigen: 2 Tage vorher`.

### Task details

Tap task → read-first detail sheet. Primary actions: edit and mark done. Editing occurs in the same sheet. Delete/archive is in overflow with confirmation.

Recurring instances show their series relationship and clearly distinguish editing one task from future series behavior.

### Finance creation

```text
Finance → FAB → Global New → Booking
→ choose Expense or Income
```

Quick fields: description, amount, date, category and payment method. Store, label/project, contract and visibility live under further options.

`Als wiederkehrende Buchung planen` transitions the same sheet into:

```text
Details → Wiederholung → Serie speichern
```

Recurrence fields include billing interval, due date, start, optional end and price validity. Contract cancellation fields never appear here.

### Booking details

Tap transaction → read-first detail sheet. Show category, payment method, store, label, visibility, source and links. Edit remains in the same sheet. Duplicate transitions cleanly to prefilled creation. Delete belongs in overflow.

### Filters

Filters are independent sheets. They never open on top of a create/detail sheet. Active search is shown only as context. Result counts appear only if reliably computed.

## Local Data and Offline Constraints

- UI changes must preserve `PRIVATE` and `FAMILY` visibility.
- Expense data remains personal according to existing permission/query behavior.
- Offline task creation, task status changes and expense creation remain functional.
- Do not offer offline Quick Add or recurring creation unless the sync model supports it.
- Pending offline changes must not be described as server-confirmed.
- Local document browsing preserves root permission checks, path normalization, symlink blocking, MIME policy and read-only assumptions.
- No visual refactor may move security enforcement from server to client.

## Implementation Guardrails

1. Read this file before authenticated app UI work.
2. Treat `main` as the functional baseline unless a branch feature is explicitly integrated.
3. Preserve business logic, routes, server actions, form names, permissions and automation.
4. Build shared primitives before page-specific markup.
5. Do not create local variants of header, FAB, search, tabs, period selector, sheets or comboboxes.
6. Keep package mockups as visual references, not literal truth for generated text/data.
7. Validate every mobile page at 390 × 844px.
8. Compare implementation screenshots with approved mockups.
9. Preserve desktop functionality while modernizing its visuals.
10. Refactor historical CSS into ordered layers/modules; do not keep appending override blocks.

## Acceptance Checklist

- Shared header, bottom navigation and FAB are pixel-consistent.
- FAB is always 56px and contains only a plus.
- Search is collapsed by default.
- Finance overview/analysis and period mode are clearly separate.
- Local icons and initial avatars work without internet.
- No provider logos appear.
- Sheets are bottom-attached, non-stacked and hide the FAB.
- Comparable sheets use aligned outer geometry and internal scrolling.
- Dropdowns are closed in standard mockups and support search/Quick Add where valid.
- Category, budget, label and comparison analysis are distinguishable and actionable.
- Color never carries meaning alone.
- Navigation/FAB never cover content.
- No horizontal overflow at 390px.
- Keyboard does not cover active fields or sticky actions.
- Existing permissions, offline queues, links, imports/exports and automations still pass tests.
- Desktop remains functionally complete.
