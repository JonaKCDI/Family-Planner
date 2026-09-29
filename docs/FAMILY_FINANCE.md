# Familienfinanzen

Unter **Finanzen → Familie** stehen ausschließlich ausdrücklich geteilte Ausgaben.
Die Buchung bleibt beim zahlenden Nutzer und wird in dessen persönlicher Übersicht
und Cockpit weiterhin einmal berücksichtigt. Einnahmen bleiben privat.

## Bedienung

- Das globale Plus erstellt weiterhin eine persönliche Ausgabe. In der Familienansicht
  ist „Mit Familie teilen“ vorausgewählt. Die Freigabe lässt sich jederzeit zurücknehmen.
- Unter **Familie → Setup** werden gemeinsame Kategorien, Labels und Budgets gepflegt.
  Alle Mitglieder können Begriffe anlegen; Änderungen und Zusammenführungen übernehmen
  Familienadmins. Persönliche Buchungen bearbeitet ausschließlich ihr Eigentümer.
- Unter **Meine Zuordnungen** verknüpft jeder seine persönlichen Begriffe mit den
  Familienbegriffen. Mehrere persönliche Begriffe dürfen dasselbe Ziel verwenden.
  Änderungen wirken auch auf ältere geteilte Buchungen; die Zuordnung allein teilt nichts.
- Die Übersicht zeigt gemeinsame Ausgaben sowie die zwei Personen mit den höchsten tatsächlich
  gezahlten Ausgaben. Unter **Analyse → Personen** bleiben alle aktiven Mitglieder sichtbar.
- Ein **Ausgleich** hält nur eine echte Zahlung zwischen zwei Mitgliedern fest. Er verändert keine
  Ausgabe und berechnet keine Sollquoten oder Schulden; „Netto getragen“ rechnet lediglich
  gesendete und erhaltene Ausgleiche in der gewählten Währung und im gewählten Zeitraum ein.
  Nur der Ersteller kann einen Ausgleich entfernen und bei Bedarf neu eintragen.
- Währungen werden getrennt ausgewertet; Budgets gelten in EUR.
- Serien und Vertrags-/Tankvorgaben können neue Ausgaben automatisch freigeben.
  Vorhandene Buchungen behalten ihre individuelle Freigabe.
- Belege erhalten durch das Teilen einer Ausgabe keine zusätzlichen Zugriffsrechte.

## Sicherung und Update

Persönliche Excel-Sicherungen enthalten die explizite Freigabe und die Namen der
zugeordneten Familienbegriffe. Alte Dateien bleiben lesbar: fehlende Freigabefelder
ändern bestehende Freigaben nicht; neue Buchungen bleiben privat.

Familienauswertungen sind ein getrenntes Excel-Format mit zahlender Person und gemeinsamen
Begriffen. Sie werden beim persönlichen Import zurückgewiesen. Synology-Auswertungen
liegen unter `EXPENSE_EXCEL_DIR` als `Familienauswertung-<Familienname>-<Jahr>.xlsx`.
Ein vollständiges Datenbankbackup sichert auch gemeinsame Budgets und ungenutzte Begriffe.

Vor einem Update die Datenbank sichern und das PostgreSQL-Volume erhalten.
`prisma migrate deploy` führt die Migration `20260911120000_family_finance` aus.
Alle bestehenden Buchungen bleiben zunächst privat, unabhängig vom alten `scope`.
Gemeinsam verwendete Ausgabenkategorien werden pro Nutzer kopiert; Buchungs-, Serien-,
Tank- und Planungsbezüge einschließlich Planungsschlüsseln werden umgestellt.
Aufgaben- und Vertragskategorien bleiben unverändert. Keine Buchung wird gelöscht.

## Verifikation

- `npm test`, `npm run lint`, `npm run build`.
- `node scripts/test-family-finance-migration.mjs` erstellt ausschließlich eine isolierte
  PostgreSQL-Testdatenbank. Für erneute Läufe einen neuen Namen über
  `FAMILY_FINANCE_TEST_DATABASE=family_finance_test_<Ziffern>` wählen.
- `node scripts/smoke-family-finance.mjs` prüft den Testserver auf Port 3102 mit der
  isolierten Datenbank `family_finance_test_20260911`: drei Nutzer, Zugriffstrennung,
  mobile Seiten, Erstellen/Bearbeiten/Freigabe, Zuordnungen und Excel-Export.
  Test-Sitzungen und zusätzlich erstellte Buchungen werden wieder entfernt.
- Docker/Compose muss vor einem Synology-Rollout separat mit einem Testprojekt und
  temporären Volumes geprüft werden, falls Docker lokal nicht verfügbar ist.
