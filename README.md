# Family Planner

Self-hosted Familien- und Alltagsorganisations-App als mobile-first Next.js/PWA. V1 konzentriert sich auf echte Nutzer, Familien-/Privat-Sichtbarkeit, Ausgaben, Aufgaben, Vertraege, manuelle Kalendertermine und HTTPS-Dokumentverweise auf Synology oder externe Quellen.

## Lokaler Start

In dieser Codex-Umgebung ist `node` vorhanden, aber aktuell kein Paketmanager im PATH. Auf deinem Rechner oder nach Tooling-Bootstrap:

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:migrate
npm run dev
```

Danach `http://localhost:3000` oeffnen. Beim ersten Aufruf erscheint der Setup-Flow fuer den ersten Admin und die Familie.

## Datenbank

Ziel-Datenbank ist PostgreSQL. Die App verwendet Prisma und das Schema liegt in `prisma/schema.prisma`.

Wichtige Sicherheitsentscheidungen:

- Passwoerter werden gehasht gespeichert.
- Sessions liegen serverseitig in der Datenbank.
- Sichtbarkeit wird pro Datensatz ueber `PRIVATE` oder `FAMILY` modelliert.
- Dokumente werden nicht hochgeladen; gespeichert werden nur HTTPS-Verweise.

## Synology Deployment

Vorgesehen ist Synology Container Manager mit Docker Compose:

```powershell
Copy-Item .env.example .env
# POSTGRES_PASSWORD in .env stark setzen
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

Empfohlen:

- App nur im Heimnetz/VPN starten.
- Fuer externen Zugriff spaeter HTTPS ueber Reverse Proxy erzwingen.
- Datenbank-Port nicht oeffentlich veroeffentlichen.
- PostgreSQL-Volume regelmaessig sichern.
- Restore mindestens einmal testen.

## Dokumentverweise

V1 akzeptiert remote-taugliche `https://` Links:

- Synology Drive/File Station Links
- WebDAV HTTPS URLs
- andere externe HTTPS-Quellen

Die App ist kein Datei-Proxy. Synology bleibt Single Source of Truth und kontrolliert den eigentlichen Dateizugriff.

## Kalender

V1 enthaelt manuelle Kalendertermine und vorbereitetes Datenmodell fuer Outlook, iCloud und CalDAV. Echter Sync ist absichtlich ein spaeteres Modul.
