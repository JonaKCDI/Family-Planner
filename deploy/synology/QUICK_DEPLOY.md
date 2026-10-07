# Synology-Update: Quick-Guide

Diese Anleitung aktualisiert ein bestehendes `family-app`-Projekt in Synology Container Manager. Sie setzt voraus, dass die App bereits läuft und echte Daten enthält.

## Vor dem Update

1. Während des Updates die App nicht verwenden lassen.
2. Prüfen, dass PostgreSQL (`db`), App (`app`) und Backup (`backup`) laufen:

   ```sh
   cd /volume1/docker/family-app/deploy/synology
   docker compose ps
   ```

3. Ein frisches Backup erstellen. Der Backup-Dienst erstellt SQL-Dateien, keine zweite Datenbank:

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
2. Vor dem Start die Compose-Konfiguration prüfen:

   ```sh
   docker compose config
   ```

3. Der neue Dokumenten-Mount ist optional. Entweder den Ordner `/volume1/docker/family-app/documents` anlegen oder `DOCUMENTS_HOST_DIR` in `.env` auf einen vorhandenen, eng begrenzten Ordner setzen. Er wird im App-Container nur lesbar unter `/mnt/documents` eingebunden. Niemals `/volume1` mounten.
4. `APP_URL`, Exportordner, Dokumentenordner und Backupordner müssen auf die bestehenden Werte zeigen. `POSTGRES_PASSWORD` nicht ändern.

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
