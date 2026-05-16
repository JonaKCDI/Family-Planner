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
