# Family Planner

Self-hosted Familien- und Alltagsorganisations-App als mobile-first Next.js/PWA. V1 konzentriert sich auf echte Nutzer, Familien-/Privat-Sichtbarkeit, Ausgaben, Aufgaben, Verträge, manuelle Kalendertermine und HTTPS-Dokumentverweise auf Synology oder externe Quellen.

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

## Ausgaben und CSV-Sicherung

Ausgaben sind bewusst persönlich pro Nutzer sichtbar. Kategorien und Labels helfen dabei, laufende Kosten und projektartige Ausgaben wie Dienstreisen oder Renovierungen getrennt auszuwerten.

Optional kann ein CSV-Spiegel für die eigenen Ausgaben gesetzt werden:

```powershell
EXPENSE_CSV_DIR="Z:\FamilyApp\expenses"
EXPENSE_CSV_PATH="/data/expenses/expenses.csv"
```

In Docker wird `EXPENSE_CSV_DIR` nach `/data/expenses` gemountet. In der App unter **Ausgaben > Setup** lassen sich die persönlichen Ausgaben importieren oder exportieren. Die CSV enthält stabile IDs, Kategorien und Labels, damit Excel-kompatible Sicherungen und spätere Re-Imports möglich bleiben. Zusätzlich gibt es dort einen direkten CSV-Download und Upload für lokale Tests ohne Synology-Pfad.

## Synology Deployment

Vorgesehen ist Synology Container Manager mit Docker Compose. Die App startet die Prisma-Migrationen beim Containerstart automatisch, wartet auf PostgreSQL und legt tägliche Datenbank-Backups in einem gemounteten Ordner ab.

```powershell
Copy-Item .env.example .env
# POSTGRES_PASSWORD und CALENDAR_SECRET in .env stark setzen
docker compose up -d --build
```

Wichtige `.env`-Werte auf der Synology:

```powershell
APP_URL="https://deine-synology-adresse"
APP_PORT="3000"
POSTGRES_PASSWORD="ein-langes-zufaelliges-passwort"
CALENDAR_SECRET="ein-anderes-langes-zufaelliges-geheimnis"
EXPENSE_CSV_DIR="/volume1/docker/family-app/expenses"
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

## Kalender

Die App unterstützt manuelle Termine, lokalen iCloud/CalDAV-Sync, ICS-Abos und Outlook-Sync über Microsoft Graph. Die App läuft lokal, aber iCloud, ICS-Quellen und Outlook bleiben externe Kalenderquellen.

### iCloud praktisch einrichten

1. Stelle sicher, dass Zwei-Faktor-Authentifizierung für deine Apple-ID aktiv ist.
2. Öffne `https://account.apple.com`.
3. Gehe zu **Anmeldung und Sicherheit** und erstelle ein **App-spezifisches Passwort**.
4. Öffne in der App den Tab **Kalender**.
5. Wähle als Anbieter **iCloud**.
6. Trage einen Anzeigenamen ein, zum Beispiel `Privat iCloud`.
7. Lasse die Kalender-URL leer. Die App nutzt dann `https://caldav.icloud.com/` und synchronisiert die gefundenen iCloud-Kalender.
8. Trage als Benutzername deine Apple-ID/E-Mail-Adresse ein.
9. Trage als Passwort das App-spezifische Passwort ein, nicht dein normales Apple-ID-Passwort.
10. Speichere die Quelle und klicke danach auf **Sync**.

Die Zugangsdaten werden mit `CALENDAR_SECRET` lokal verschlüsselt in PostgreSQL gespeichert. Setze `CALENDAR_SECRET` auf der Synology unbedingt auf einen langen eigenen Wert.

### ICS-Link abonnieren

1. Erzeuge in Outlook, iCloud oder einem anderen Kalender einen privaten ICS-/Abo-Link.
2. Öffne in der App **Kalender > Menü**.
3. Wähle als Anbieter **ICS-Link**.
4. Trage einen Anzeigenamen und die ICS-URL ein.
5. Wähle die Familiensichtbarkeit und speichere.

ICS-Links sind geheime Leselinks. Wer den Link kennt, kann den Kalender je nach Freigabe lesen. Teile ihn deshalb nicht öffentlich.

### Outlook praktisch einrichten

In der App selbst findest du unter **Kalender > Menü > Outlook per Microsoft-Login** einen geführten Workflow. Die Anmeldung selbst passiert über Microsoft; die App fragt kein Outlook-Passwort ab.

1. Öffne im Microsoft Entra Admin Center eine neue **App registration**.
2. Setze als Redirect URI `http://localhost:3000/api/outlook/callback` für lokale Tests. Auf der Synology später entsprechend deine HTTPS-Adresse verwenden.
3. Erstelle unter **Certificates & secrets** ein Client Secret.
4. Erlaube Microsoft Graph Delegated Permissions: `User.Read`, `Calendars.Read` und `offline_access`.
5. Trage in `.env` ein:

```powershell
OUTLOOK_CLIENT_ID="..."
OUTLOOK_CLIENT_SECRET="..."
OUTLOOK_TENANT="common"
OUTLOOK_REDIRECT_URI="http://localhost:3000/api/outlook/callback"
```

6. Starte die App neu, öffne **Kalender > Menü** und klicke **Outlook verbinden**.

Die App speichert kein Outlook-Passwort. Access- und Refresh-Tokens werden mit `CALENDAR_SECRET` lokal verschlüsselt gespeichert.

Hinweis für Uni-/Firmenkonten: Auch der normale Microsoft-Login braucht technisch eine registrierte App-ID. Wenn deine Organisation externe Apps blockiert oder User Consent deaktiviert hat, muss ein Admin die App freigeben. Ohne diese Freigabe kann die App deine Outlook-Daten nicht über Microsoft Graph lesen.
