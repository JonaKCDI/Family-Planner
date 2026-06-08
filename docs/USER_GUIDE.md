# Family App installieren

Diese Anleitung ist für eine frische Installation auf einer Synology NAS gedacht. Ziel: Du kopierst den Projektordner auf die NAS, trägst wenige Werte ein, startest das Docker-Projekt und legst danach in der App den ersten Admin an.

Das konkrete Container-Manager-Bundle liegt zusätzlich in `deploy/synology`. Nutze diesen Ordner als Projektpfad, wenn du die vorbereitete Synology-Compose-Datei samt Checkliste verwenden möchtest.

## Kurzfassung

1. Synology **Container Manager** installieren.
2. Ordner `/volume1/docker/family-app` anlegen.
3. Den kompletten Projektordner dorthin kopieren.
4. `.env.example` zu `.env` kopieren und die Werte unten eintragen.
5. In Container Manager ein neues Projekt aus `compose.yaml` starten.
6. App öffnen und den ersten Admin im Setup anlegen.
7. Prüfen, ob Login, Ausgaben-Export und Backups funktionieren.

## Vorher Entscheiden

Für den Start reicht eine lokale Adresse:

```text
http://NAS-IP:3000
```

Beispiel:

```text
http://192.168.178.20:3000
```

Für iPhone-Installation als PWA ist später HTTPS schöner und oft nötig. Das kann nach der ersten funktionierenden Installation über Synology Reverse Proxy ergänzt werden. Starte zuerst einfach.

## Frischinstallation

Wenn du wirklich sauber neu starten willst, nutze einen neuen leeren Projektordner und ein neues Docker-Volume. Bestehende Datenbank-Volumes enthalten alte App-Daten.

Für eine frische Synology-Installation:

1. Stoppe ein altes `family-app` Projekt, falls es existiert.
2. Sichere alte Backups und Excel-Dateien, falls du sie noch brauchst.
3. Lösche nur dann alte Container/Volumes, wenn du wirklich alle alten App-Daten verwerfen willst.
4. Lege den Projektordner neu an:

```text
/volume1/docker/family-app
```

5. Lege darin diese Unterordner an:

```text
/volume1/docker/family-app/expenses
/volume1/docker/family-app/mileage
/volume1/docker/family-app/backups
```

## Projektdateien Kopieren

Kopiere den kompletten Projektordner auf die NAS. Wichtig ist, dass diese Dateien und Ordner vorhanden sind:

```text
compose.yaml
Dockerfile
package.json
package-lock.json
prisma/
public/
scripts/
src/
.env
```

Nur `compose.yaml` allein reicht nicht, weil die App auf der NAS aus dem Projektordner gebaut wird.

## `.env` Anlegen

Kopiere `.env.example` zu `.env`.

Für den ersten Start auf der Synology reichen diese Werte:

```env
APP_URL="http://192.168.178.20:3000"
APP_PORT="3000"

POSTGRES_PASSWORD="bitte-ein-sehr-langes-zufaelliges-passwort-eintragen"

EXPENSE_EXCEL_HOST_DIR="/volume1/docker/family-app/expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
MILEAGE_EXCEL_HOST_DIR="/volume1/docker/family-app/mileage"
MILEAGE_EXCEL_DIR="/data/mileage"

BACKUP_DIR="/volume1/docker/family-app/backups"
BACKUP_RETENTION_DAYS="30"
BACKUP_TIME="01:00"
TZ="Europe/Berlin"
```

Ersetze `192.168.178.20` durch die IP deiner NAS.

Wichtig:

- `POSTGRES_PASSWORD` nur einmal setzen und danach nicht ohne Grund ändern.
- `EXPENSE_EXCEL_HOST_DIR` ist der Synology-Ordner.
- `EXPENSE_EXCEL_DIR` ist der Pfad im Container und bleibt normalerweise `/data/expenses`.
- `MILEAGE_EXCEL_HOST_DIR` ist der Synology-Ordner für Verbrauchsdateien.
- `MILEAGE_EXCEL_DIR` ist der Pfad im Container und bleibt normalerweise `/data/mileage`.
- `BACKUP_TIME="01:00"` bedeutet ein Backup täglich um 01:00 Uhr in der gesetzten Zeitzone.

## Start In Container Manager

1. Öffne **Container Manager**.
2. Gehe zu **Project**.
3. Erstelle ein neues Projekt.
4. Projektname: `family-app`.
5. Projektpfad: `/volume1/docker/family-app`.
6. Compose-Datei: vorhandene `compose.yaml` verwenden.
7. Projekt bauen und starten.

Der erste Start dauert länger, weil Node-Abhängigkeiten installiert und die App gebaut werden.

## Prüfen Ob Alles Läuft

Öffne im Browser:

```text
http://NAS-IP:3000
```

Beim ersten Start sollte automatisch die Setup-Seite erscheinen. Dort legst du an:

- Familienname
- erster Admin-Nutzer
- Admin-Passwort

Danach:

1. Einloggen.
2. Unter **Einstellungen** die Synology-Übersicht prüfen.
3. Eine Test-Ausgabe anlegen.
4. In **Ausgaben** Excel exportieren und testweise wieder hochladen.
5. Auf der NAS prüfen, ob im Ordner `backups` eine Backup-Datei entsteht.

## Was Läuft Im Hintergrund?

Das Compose-Projekt startet drei Container:

| Container | Aufgabe |
| --- | --- |
| `app` | Familien-App auf Port 3000 |
| `db` | PostgreSQL-Datenbank |
| `backup` | erstellt regelmäßig Datenbank-Backups |

Die Datenbank wird nicht öffentlich freigegeben. Nur die App ist über `APP_PORT` erreichbar.

Beim Start wartet die App auf PostgreSQL, führt automatisch Prisma-Migrationen aus und startet dann den Next.js-Server.

## Sicherheit Vor Migrationen

Vor Migrationen auf einer Datenbank mit echten Daten immer zuerst ein SQL-Backup prüfen. Die alte Kalender-Entfernungsmigration archiviert vorhandene Kalender-Tabellen vor dem Drop, falls sie existieren. Trotzdem bleibt das `.sql.gz` Backup die entscheidende Wiederherstellungsquelle.

## Updates

Vor jedem Update:

1. Prüfen, ob im Backup-Ordner aktuelle `.sql.gz` Dateien liegen.
2. `.env` sichern.
3. Neue Projektdateien auf die NAS kopieren.
4. Container-Manager-Projekt neu bauen/starten.

Per SSH wäre das:

```bash
cd /volume1/docker/family-app
docker compose up -d --build
```

## HTTPS Und iPhone Später Ergänzen

Wenn die App lokal funktioniert, kannst du HTTPS einrichten:

1. Eine Domain oder lokale Subdomain wählen, zum Beispiel `familie.example.com`.
2. In DSM ein Zertifikat für diese Domain hinterlegen.
3. In DSM Reverse Proxy einrichten:

```text
Quelle: HTTPS familie.example.com:443
Ziel:   HTTP 127.0.0.1:3000
```

4. In `.env` ändern:

```env
APP_URL="https://familie.example.com"
```

5. Projekt neu starten.
6. Auf dem iPhone in Safari öffnen und **Zum Home-Bildschirm** hinzufügen.

Für den allerersten Test ist HTTPS nicht nötig. Für eine dauerhaft angenehme iPhone-Nutzung ist es empfehlenswert.

## Fehlerbehebung

### App öffnet nicht

Prüfe in Container Manager:

- Läuft `app`?
- Läuft `db`?
- Ist `app` als healthy markiert?
- Stimmen `APP_PORT` und Browser-Adresse überein?

Logs ansehen:

```bash
docker compose logs -f app
```

### Datenbank startet nicht

Häufige Ursache:

- `POSTGRES_PASSWORD` fehlt in `.env`.

### Excel-Export schreibt nicht

Prüfe:

```env
EXPENSE_EXCEL_HOST_DIR="/volume1/docker/family-app/expenses"
EXPENSE_EXCEL_DIR="/data/expenses"
MILEAGE_EXCEL_HOST_DIR="/volume1/docker/family-app/mileage"
MILEAGE_EXCEL_DIR="/data/mileage"
```

Die Ordner `expenses` und `mileage` müssen existieren und für Container Manager beschreibbar sein.

### Backups fehlen

Prüfe:

- Ordner `backups` existiert.
- Ordner ist beschreibbar.
- `backup` Container läuft.
- `scripts/backup-postgres.sh` wurde mitkopiert.

Logs:

```bash
docker compose logs -f backup
```

### Nach Update ist etwas kaputt

1. App stoppen.
2. Letztes Backup aus `backups` sichern.
3. Logs prüfen.
4. Nicht vorschnell das Datenbank-Volume löschen.

## Wiederherstellung Aus Backup

Nur verwenden, wenn du bewusst eine Datenbank wiederherstellen willst.

Manueller Restore per SSH:

```bash
gzip -dc family-app-YYYYMMDD-HHMMSS.sql.gz | docker compose exec -T db psql -U family_app -d family_app
```

Vorher unbedingt sicherstellen, dass du das richtige Backup und das richtige Projekt verwendest.

## Welche Dateien Sind Wichtig?

| Datei | Zweck |
| --- | --- |
| `compose.yaml` | Startet App, Datenbank und Backup |
| `.env` | Deine echten Einstellungen und Passwörter |
| `.env.example` | Vorlage ohne echte Geheimnisse |
| `Dockerfile` | Baut die App |
| `prisma/` | Datenbankschema und Migrationen |
| `scripts/backup-postgres.sh` | Backup-Automation |
| `expenses/` | Excel-Ablage für persönliche Ausgaben |
| `mileage/` | Excel-Ablage für Verbrauchsdateien pro Auto |
| `backups/` | Datenbank-Backups |
