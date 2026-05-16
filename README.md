# Family Planner

Self-hosted Familien- und Alltagsorganisations-App als mobile-first Next.js/PWA. V1 konzentriert sich auf echte Nutzer, Familien-/Privat-Sichtbarkeit, Ausgaben, Aufgaben, Verträge und HTTPS-Dokumentverweise auf Synology oder externe Quellen.

## Lokaler Start

In dieser Codex-Umgebung ist `node` vorhanden, aber aktuell kein Paketmanager im PATH. Auf deinem Rechner oder nach Tooling-Bootstrap:

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:migrate
npm run dev
```

Danach `http://localhost:3000` öffnen. Beim ersten Aufruf erscheint der Setup-Flow für den ersten Admin und die Familie.

## Datenbank

Ziel-Datenbank ist PostgreSQL. Die App verwendet Prisma und das Schema liegt in `prisma/schema.prisma`.

Wichtige Sicherheitsentscheidungen:

- Passwörter werden gehasht gespeichert.
- Sessions liegen serverseitig in der Datenbank.
- Sichtbarkeit wird pro Datensatz über `PRIVATE` oder `FAMILY` modelliert.
- Dokumente werden nicht hochgeladen; gespeichert werden nur HTTPS-Verweise.

## Ausgaben und Excel-Sicherung

Ausgaben sind bewusst persönlich pro Nutzer sichtbar. Kategorien und Labels helfen dabei, laufende Kosten und projektartige Ausgaben wie Dienstreisen oder Renovierungen getrennt auszuwerten.

Optional kann ein Excel-Ordner für die eigenen Ausgaben gesetzt werden:

```powershell
EXPENSE_EXCEL_HOST_DIR="Z:\FamilyApp\expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
```

In Docker wird `EXPENSE_EXCEL_HOST_DIR` nach `/data/expenses` gemountet. In der App unter **Ausgaben > Setup** lassen sich die persönlichen Ausgaben als Excel-Datei importieren oder exportieren. Pro Nutzer und Jahr entsteht eine Datei wie `Ausgaben-Jona-2026.xlsx`. Der Download/Upload funktioniert zusätzlich lokal ohne Synology-Pfad.

## Implementierungsstand

Eine strukturierte Übersicht aller aktuell implementierten Module, Integrationen und Deployment-Bausteine steht in [`docs/IMPLEMENTATION_OVERVIEW.md`](docs/IMPLEMENTATION_OVERVIEW.md).

Der finale Abschlussbericht mit Sicherheits- und Installationshinweisen steht in [`docs/FINAL_REPORT.md`](docs/FINAL_REPORT.md).

## Synology Deployment

Ausführliche Schritt-für-Schritt-Hilfe für Synology Container Manager, Docker-Volumes, lokale HTTPS-Adresse und iPhone/PWA-Installation steht in [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md). Das konkrete Synology-Handoff-Bundle liegt in [`deploy/synology`](deploy/synology).

Vorgesehen ist Synology Container Manager mit Docker Compose. Die App startet die Prisma-Migrationen beim Containerstart automatisch, wartet auf PostgreSQL und legt tägliche Datenbank-Backups in einem gemounteten Ordner ab.

```powershell
Copy-Item .env.example .env
# POSTGRES_PASSWORD in .env stark setzen
docker compose up -d --build
```

Wichtige `.env`-Werte auf der Synology:

```powershell
APP_URL="https://deine-synology-adresse"
APP_PORT="3000"
POSTGRES_PASSWORD="ein-langes-zufaelliges-passwort"
EXPENSE_EXCEL_HOST_DIR="/volume1/docker/family-app/expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
BACKUP_DIR="/volume1/docker/family-app/backups"
BACKUP_RETENTION_DAYS="30"
```

Empfohlen:

- App nur im Heimnetz/VPN starten.
- Für externen Zugriff später HTTPS über Reverse Proxy erzwingen.
- Datenbank-Port nicht öffentlich veröffentlichen.
- PostgreSQL-Volume und Backup-Ordner regelmäßig sichern.
- Restore mindestens einmal testen.

### Datenbank-Backup und Restore

Der `backup`-Service schreibt standardmäßig täglich eine komprimierte Datei wie `family-app-20260514-020000.sql.gz` in `BACKUP_DIR`. Ältere Dumps werden nach `BACKUP_RETENTION_DAYS` automatisch gelöscht, damit der Backup-Ordner nicht unbegrenzt wächst.

Manueller Dump:

```powershell
docker compose exec db pg_dump -U family_app -d family_app | gzip > family-app-manual.sql.gz
```

Restore in eine leere Datenbank:

```powershell
gzip -dc family-app-manual.sql.gz | docker compose exec -T db psql -U family_app -d family_app
```

Die Dumps sind normale PostgreSQL-SQL-Backups. Du kannst sie später auch außerhalb der App mit PostgreSQL, DBeaver, pgAdmin oder eigenen SQL-Skripten weiterverwenden.

## Offline auf dem Handy

Die App ist als PWA installierbar und speichert Ausgaben sowie Aufgaben offline in IndexedDB, wenn dein Handy die Synology gerade nicht erreicht. Sobald die PWA im Heim-WLAN wieder geöffnet oder in den Vordergrund geholt wird, schiebt sie ausstehende Änderungen an den Server.

Wichtig für iPhone/iOS: Hintergrund-Sync ist nicht garantiert. Zuverlässig ist der Sync beim Öffnen oder Aktivieren der PWA, wenn die Synology-Adresse wieder erreichbar ist.

Offline v1 unterstützt:

- neue Ausgaben erfassen
- neue Aufgaben erfassen
- Aufgabenstatus ändern
- automatische Synchronisierung beim Wiederverbinden

## Dokumentverweise

V1 akzeptiert remote-taugliche `https://` Links:

- Synology Drive/File Station Links
- WebDAV HTTPS URLs
- andere externe HTTPS-Quellen

Die App ist kein Datei-Proxy. Synology bleibt Single Source of Truth und kontrolliert den eigentlichen Dateizugriff.
