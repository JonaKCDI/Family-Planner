# AGENTS.md

## Project Guidance

- This is a self-hosted family organization app built with Next.js, Prisma, and PostgreSQL.
- Keep the app mobile-first, especially for iPhone-sized screens.
- Prefer overview-first pages. Creation flows should open from the global floating plus button, not occupy permanent page space.
- Preserve user data and avoid destructive changes. Expenses are personal per user; shared areas should keep their family/private visibility model.
- Use clear German UI copy with correct umlauts.
- Use Prisma migrations for schema changes and keep Docker/Synology deployment in mind.
- CSV/Excel-compatible export and import are important safety features for personal expense data.

## UI Direction

- Keep layouts dense but calm: compact cards, clear tables/lists, and controls hidden behind intentional actions where appropriate.
- Avoid decorative clutter. Prioritize readable overviews, especially for many expenses, categories, and tasks.
- The floating plus button is the only entry point for creating new expenses, tasks, contracts, and document references.
