# UI Guidelines

This file is the practical implementation guide for future UI work. `DESIGN.md`
defines the broader product direction; this file records the approved patterns
from the current Aufgaben mobile pass so other pages can be adapted consistently.

## Canonical Reference

Use the Aufgaben page as the current approved mobile reference:

- `src/app/(app)/aufgaben/page.tsx`
- `src/components/task-toolbar.tsx`
- `src/components/task-summary-strip.tsx`
- `src/components/task-inline-check.tsx`
- `src/components/task-edit-form.tsx`
- `src/components/create-modal.tsx`
- `src/components/action-modal.tsx`
- `src/app/globals.css`

For NAS/file selection patterns, also use:

- `src/components/document-file-picker.tsx`
- `src/components/document-file-preview.tsx`

## Overall Direction

- Mobile PWA is the design priority. Validate at about `390 x 844px`.
- Desktop should keep the existing functional density from `main`; do not turn it
  into a stretched mobile layout.
- The app background is white or near-white. Avoid heavy page containers.
- Keep layouts dense but calm: compact lists, clear section headers, and controls
  hidden behind intentional actions.
- Use petrol for primary actions, active selections and key affordances.
- Do not put outlined boxes around simple header icons such as search, filter,
  sort, settings or close. Use plain icon buttons unless the control is a real
  form field or primary action.
- Use the app font configured in `globals.css` consistently across pages and
  sheets. Avoid very heavy text inside selects, inputs and modal content.
- Use lucide icons for familiar actions.

## Mobile Page Pattern

- Main pages are overview-first. Search, filter and sort are secondary controls,
  not permanent full-width blocks.
- Title rows may host compact icon actions. Search should expand from the search
  icon into the title area and close with the matching reverse animation.
- Filter and sort use sheets, not new pages.
- The global circular plus button remains the creation entry point.
- Keep vertical rhythm compact. Section headers should sit close to their lists;
  repeated rows should not feel like large cards unless they need that space.

## Aufgabe List Pattern

The accepted task row pattern is:

```text
[checkbox]  title                         due date
            avatar + assignee             status/priority text
```

- The checkbox is vertically centered on the left.
- Clicking the checkbox only toggles completion. It must not open details.
- Completed tasks show the same checked state on first render.
- The check animation should feel drawn, as if someone just made the mark.
- Tapping the rest of the row opens the read-only detail sheet.
- Do not use a separate colored priority dot in the task row. It used too much
  vertical space and is no longer part of the accepted pattern.
- Priority/urgency is shown through text and subtle row tint:
  - urgent or due tomorrow: solid pale red background and red border/text;
  - soon or warning: solid pale yellow background and matching border/text;
  - normal/planned: white row with subtle border.
- Do not use gradients for urgent rows.

## Summary Strip And Filters

- The overview strip doubles as the quick filter control.
- Items such as open, overdue, planned and completed are tappable.
- The default active item is open.
- Tapping an active item clears the quick filter and shows all tasks.
- Active state uses a petrol/green highlight.
- Labels and numbers are horizontally centered.
- The strip background is off-white.
- The active highlight slides between already-active items.
- When the last active item is cleared, the highlight disappears instead of
  sliding away.
- On the first activation from no selection, the highlight appears without a
  slide.

## Sheets And Popups

Use bottom sheets on mobile and keep them visually related across the app.

- Keep to a small set of sheet heights: compact, medium/action and large/create.
- Comparable sheets should share aligned header/footer baselines.
- Opening, closing and page transitions should be subtle and smooth.
- Avoid excessive white space, but do not solve content by making sheets huge.
- Prefer no internal scrolling when the content naturally fits. If it does not
  fit, scroll the sheet body rather than the page behind it.
- Use one close X in the sheet header.
- Multi-step sheets use one local back arrow inside the sheet body/subpage, not
  stacked header and body back arrows.
- Do not stack sheets or open a new popup on top of another popup.
- Do not use nested cards inside sheets. Use rows, dividers and fields.
- Select/dropdown text should be readable but not bold-heavy.

## Create And Edit Sheets

Task creation is the source pattern for create/edit flows:

- The header is simple: title in petrol, close X on the right.
- The primary page contains the common fields first.
- Optional groups move to subpages such as further options and recurrence.
- The save button stays in a consistent position.
- Subpage rows must actually work; do not show inert chevrons.
- Editing a task must reuse the same create sheet structure and classes, only
  with adjusted title/copy and prefilled values.
- Do not use a generic action modal for task editing if it changes the height,
  spacing or available subpages.

For tasks specifically:

- Priority belongs on the first page.
- Further options contains visibility and document/NAS references.
- Recurrence opens a recurrence settings subpage.
- If a task belongs to a recurring series, editing must allow updating the linked
  series values supported by the data model.

## Detail Sheets

Detail sheets are read-first. Editing is intentional.

- Header row: completion checkbox, title, classic edit/pencil icon.
- Do not show a status dropdown or an "open" label beside the checkbox.
- The edit icon opens the edit sheet using the same structure as task creation.
- Detail labels such as due date, assignee, priority and visibility must be large
  enough to read comfortably on mobile.
- Recurring tasks show their series and interval information.
- Primary actions belong at the bottom only when they are not already represented
  in the header. For tasks, completion lives in the header checkbox.

## NAS/File Picker

- Show up to three document roots side by side. If there are more than three,
  use a dropdown for the additional roots.
- File rows should stay stable in height.
- Use an eye icon for preview.
- Use a checkbox with a checkmark for selecting files.
- Do not expand a row downward just to reveal preview/select actions.
- The pattern should allow selecting multiple documents for one item.

## Do Not Reintroduce

- Boxed icon buttons in mobile page headers.
- Gradient urgency backgrounds.
- Separate colored priority dots in task rows.
- Status dropdowns in task details.
- Duplicate back arrows in sheets.
- Heavy bold values inside dropdowns.
- Detached modal cards for mobile flows.
- Inert chevron rows that look tappable but do nothing.
- Page scroll lock regressions when a sheet closes.
