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
- Für externen Zugriff später HTTPS über Reverse Proxy erzwingen.
- Datenbank-Port nicht öffentlich veröffentlichen.
- PostgreSQL-Volume regelmäßig sichern.
- Restore mindestens einmal testen.

## Dokumentverweise

V1 akzeptiert remote-taugliche `https://` Links:

- Synology Drive/File Station Links
- WebDAV HTTPS URLs
- andere externe HTTPS-Quellen

Die App ist kein Datei-Proxy. Synology bleibt Single Source of Truth und kontrolliert den eigentlichen Dateizugriff.

## Kalender

Die App unterstützt manuelle Termine und lokalen iCloud/CalDAV-Sync. Die App läuft lokal, aber iCloud bleibt eine Apple-Cloud-Datenquelle.

### iCloud praktisch einrichten

1. Stelle sicher, dass Zwei-Faktor-Authentifizierung für deine Apple-ID aktiv ist.
2. Öffne `https://account.apple.com`.
3. Gehe zu **Anmeldung und Sicherheit** und erstelle ein **App-spezifisches Passwort**.
4. Öffne in der App den Tab **Kalender**.
5. Wähle als Anbieter **iCloud**.
6. Trage einen Anzeigenamen ein, zum Beispiel `Privat iCloud`.
7. Lasse die Kalender-URL leer. Die App nutzt dann `https://caldav.icloud.com/` und sucht den ersten passenden Kalender.
8. Trage als Benutzername deine Apple-ID/E-Mail-Adresse ein.
9. Trage als Passwort das App-spezifische Passwort ein, nicht dein normales Apple-ID-Passwort.
10. Speichere die Quelle und klicke danach auf **Sync**.

Die Zugangsdaten werden mit `CALENDAR_SECRET` lokal verschlüsselt in PostgreSQL gespeichert. Setze `CALENDAR_SECRET` auf der Synology unbedingt auf einen langen eigenen Wert.
