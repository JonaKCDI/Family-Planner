# Synology-Update: Quick-Guide

Diese Anleitung aktualisiert ein bestehendes `family-app`-Projekt in Synology Container Manager. Sie setzt voraus, dass die App bereits läuft und echte Daten enthält.

## Vor dem Update

1. Während des Updates die App nicht verwenden lassen.
2. Prüfen, dass PostgreSQL (`db`), App (`app`) und Backup (`backup`) laufen:

   ```sh
   cd /volume1/docker/family-app/deploy/synology
   docker compose ps
   ```

3. Das letzte automatische `.sql.gz`-Backup auf Aktualität und Lesbarkeit prüfen. Es reicht für das Update aus, wenn seitdem keine Daten hinzugekommen sind, die bei einer Wiederherstellung verloren gingen. Für einen Sicherungsstand unmittelbar vor dem Update stattdessen ein manuelles Backup erstellen:

   ```sh
   backup_name="family-app-before-update-$(date +%Y%m%d-%H%M%S).sql.gz"
   backup_file="/volume1/docker/family-app/backups/$backup_name"
   docker compose exec -T db sh -c 'pg_dump -U family_app -d family_app -f /tmp/family-app-before-update.sql && gzip -f /tmp/family-app-before-update.sql'
   docker compose cp db:/tmp/family-app-before-update.sql.gz "$backup_file"
   test -s "$backup_file" && gzip -t "$backup_file"
   docker compose exec -T db rm -f /tmp/family-app-before-update.sql.gz
   ```

   Sicherstellen, dass genau die neue Datei vorhanden und nicht leer ist. Eine Kopie davon außerhalb des PostgreSQL-Volumes aufbewahren.
4. Für die stärkste Vorabprüfung den Dump in eine **separate temporäre Datenbank** zurückspielen und dort mit dem neuen App-Image Migration und Start prüfen. Nicht `restore-postgres.sh` dafür verwenden: Das Skript stellt in die laufende `family_app`-Datenbank wieder her.
5. Den aktuellen Projektordner oder mindestens Compose-Datei, `.env` und verwendeten Quellstand sichern. `.env` nicht überschreiben; insbesondere `POSTGRES_PASSWORD` beibehalten.

## Dateien und Docker-Konfiguration aktualisieren

1. Den freigegebenen `main`-Stand nach `/volume1/docker/family-app` übernehmen. `deploy/synology/.env` aus dem bestehenden Projekt behalten.
2. Die vorhandenen Mounts wie unten beschrieben prüfen. Bei einem anderen NAS-Ordner für Dokumente genügt es, `DOCUMENTS_HOST_DIR` in der bestehenden `.env` anzupassen. Die `.env` nicht durch `.env.example` ersetzen.
3. Vor dem Start die Compose-Konfiguration prüfen:

   ```sh
   docker compose config
   ```

4. `APP_URL`, Exportordner, Dokumentenordner und Backupordner müssen auf die bestehenden Werte zeigen. `POSTGRES_PASSWORD` nicht ändern. Die Ausgabe von `docker compose config` enthält Konfigurationswerte und sollte nicht unbereinigt weitergegeben werden.

### NAS-Verzeichnisse und Schreibrechte

Die Standard-Mounts stehen bereits in `deploy/synology/compose.yaml`. Links vom Doppelpunkt steht der NAS-Pfad (meist über `.env` gesetzt), rechts der Pfad im Container. Für die vorhandenen Mounts ist normalerweise **keine Änderung an der YAML-Datei** nötig.

| NAS-Ordner / Volume | Pfad im Container | Zugriff | Zweck |
| --- | --- | --- | --- |
| `EXPENSE_EXCEL_HOST_DIR` | `/data/expenses` | Lesen und Schreiben | Excel-Import und -Export für Ausgaben |
| `MILEAGE_EXCEL_HOST_DIR` | `/data/mileage` | Lesen und Schreiben | Excel-Import und -Export für Kilometer |
| `DOCUMENTS_HOST_DIR` | `/mnt/documents` | **Nur Lesen (`:ro`)** | NAS-Dokumente durchsuchen, ansehen und herunterladen |
| `BACKUP_DIR` | `/backups` im Backup-Container | Lesen und Schreiben | Automatische Datenbank-Dumps |
| `family_app_postgres` | `/var/lib/postgresql/data` | Lesen und Schreiben | Bestehende PostgreSQL-Daten; Volume bei Updates behalten |

Beispiel für einen vorhandenen Dokumentenordner auf dem NAS in `deploy/synology/.env`:

```env
DOCUMENTS_HOST_DIR="/volume1/Familie/Dokumente"
DOCUMENTS_DIR="/mnt/documents"
```

Die dazugehörige Zeile in `compose.yaml` bleibt `- ${DOCUMENTS_HOST_DIR:-/volume1/docker/family-app/documents}:/mnt/documents:ro`. Der Ordner auf dem NAS muss vor dem Start existieren und für den Container lesbar sein. `:ro` verhindert Schreibzugriffe aus diesem Container; es ersetzt nicht die NAS-Dateirechte und die Berechtigungen für Dokumentbereiche in der App. Nur einen eng begrenzten Ordner mounten, niemals `/volume1` oder eine komplette Freigabe mit fremden Daten. Wenn du die Dokumentenfunktion nicht nutzt, den im YAML festgelegten leeren Standardordner trotzdem anlegen.

In **Einstellungen > Dokumentbereiche** werden anschließend Pfade **aus Sicht des Containers** eingetragen, zum Beispiel `/mnt/documents/Familie`, nicht `/volume1/Familie/Dokumente/Familie`. Bereits angelegte Dokumentbereiche speichern diesen Container-Pfad; bei einem Update `/mnt/documents` daher beibehalten. Für mehrere Unterordner unter demselben NAS-Ordner reicht ein einzelner Mount.

Für einen zusätzlichen, getrennt liegenden NAS-Ordner ist eine weitere Zeile unter `services.app.volumes` in `compose.yaml` nötig, zum Beispiel:

```yaml
- /volume1/Privat/Jona:/mnt/jona-dokumente:ro
```

Danach in der App einen eigenen Dokumentbereich mit dem Container-Pfad `/mnt/jona-dokumente` und passenden App-Berechtigungen anlegen. Jeder zusätzliche Dokumenten-Mount benötigt `:ro` und einen eigenen Container-Pfad.

Die Excel- und Backup-Mounts nicht auf `:ro` setzen: Die App beziehungsweise der Backup-Container müssen dort Dateien schreiben können. Das PostgreSQL-Volume nicht löschen oder durch einen leeren Ordner ersetzen.

## Update starten

Im bestehenden Container-Manager-Projekt **Rebuild** und **Start** ausführen. Dabei das PostgreSQL-Volume `family_app_postgres` und alle Datenordner unverändert weiterverwenden.

Beim App-Start wartet der Entrypoint auf PostgreSQL, führt `prisma migrate deploy` aus und startet erst danach Next.js. Die aktuellen Migrationen ergänzen Budget-Zeiträume und die zuletzt gewählte Fahrzeug-ID. Keine zusätzliche Datenbank oder Umgebungsvariable ist dafür erforderlich.

**Wichtig:** Niemals `docker compose down -v` verwenden, kein PostgreSQL-Volume löschen und kein neues Projekt mit einem leeren Volume als Update starten.

## Nach dem Start prüfen

```sh
docker compose ps
docker compose logs --tail=150 app db backup
```

Fortfahren, wenn alle drei Container laufen, die App-Logs erfolgreiche Migrationen und einen gestarteten Server zeigen und `http://NAS-IP:3000/api/health` `ok` liefert. Danach mindestens prüfen:

- Anmelden und bestehende Ausgaben, Familienfinanzen und Kategorien öffnen.
- Eine Ausgabe anzeigen und bearbeiten; Budget-Zeiträume öffnen.
- Kilometer-Seite mit Fahrzeugauswahl öffnen.
- Excel-Export sowie Dokumentenliste/Dateizugriff prüfen, falls der NAS-Mount eingerichtet ist.
- Sicherstellen, dass das nächste tägliche Backup wieder im Backup-Ordner erscheint.

## Bei Problemen

1. Keine weiteren Schreibvorgänge in der App durchführen.
2. App- und Datenbank-Logs sichern und den Fehler eingrenzen. Das PostgreSQL-Volume nicht löschen.
3. Wenn nur die App-Version fehlerhaft ist, zuerst den vorherigen App-Quellstand wiederherstellen und mit demselben PostgreSQL-Volume starten. Bereits angewendete Migrationen nicht manuell aus `prisma_migrations` entfernen.
4. Ein Datenbank-Restore ersetzt Daten und ist der letzte Schritt. Vorher den aktuellen Zustand zusätzlich sichern, die richtige Sicherungsdatei doppelt prüfen und den Restore bewusst in die produktive Datenbank ausführen. Das vorhandene Skript stellt direkt in `family_app` wieder her:

   ```sh
   sh scripts/restore-postgres.sh /volume1/docker/family-app/backups/GEPRUEFTES-BACKUP.sql.gz
   ```

   Danach die dazu passende App-Version starten und Anmeldung, Daten sowie Exporte erneut prüfen.

Das nächtliche `.sql.gz`-Backup ist eine Wiederherstellungsdatei, keine laufende Backup-Datenbank. Ein Restore-Test gehört in eine temporäre getrennte Datenbank.
