# Analytics-Logik

Diese Datei definiert die fachliche Berechnungslogik für Analytics in der Family App. Sie ist bewusst streng formuliert, damit Auswertungen für Kategorien, Labels, Zeiträume und Drilldowns konsistent bleiben.

## Grundmodell

Ausgaben und Einnahmen werden im Datenmodell als positive Beträge mit einer Art gespeichert:

- `kind = EXPENSE`: Ausgabe
- `kind = INCOME`: Einnahme
- `amountCents`: positiver Betrag in Cent

Die App darf für Analytics niemals implizit davon ausgehen, dass ein Betrag durch sein Vorzeichen erklärt wird. Die Richtung kommt immer aus `kind`.

## Zentrale Begriffe

Für jede Auswertungseinheit, also Zeitraum, Kategorie, Label, Händler, Vertrag oder Dokumentstatus, gelten dieselben Grundwerte:

- `income`: Summe aller Beträge mit `kind = INCOME`
- `spending`: Summe aller Beträge mit `kind = EXPENSE`
- `saldo`: `income - spending`
- `netConsumption`: `max(0, spending - income)`
- `activity`: `income + spending`
- `entryCount`: Anzahl aller Einträge
- `incomeCount`: Anzahl Einnahmen
- `spendingCount`: Anzahl Ausgaben

`saldo` ist kein Summenfeld aus Rohbeträgen. `saldo` muss immer aus getrennt aggregierten Einnahmen und Ausgaben berechnet werden.

`netConsumption` beschreibt den budgetwirksamen Verbrauch. Rückerstattungen, Erstattungen von Auslagen oder andere Einnahmen innerhalb derselben Kategorie oder desselben Labels reduzieren diesen Verbrauch. Der Wert fällt nicht unter null, damit ein Einnahmenüberschuss nicht als negatives verbrauchtes Budget erscheint.

## Harte Invarianten

Diese Regeln dürfen nicht gebrochen werden:

- Kategorien können Einnahmen und Ausgaben enthalten.
- Labels können Einnahmen und Ausgaben enthalten.
- Kategorie- und Label-Auswertungen müssen `income`, `spending` und `saldo` getrennt kennen.
- Eine gemischte Kategorie darf niemals nur als Summe aller absoluten Beträge dargestellt werden.
- Eine gemischte Kategorie darf niemals nur als Ausgabensumme dargestellt werden, wenn dadurch Einnahmen unsichtbar werden.
- Der sichtbare Hauptwert muss eindeutig benannt sein: `Saldo`, `Ausgaben`, `Einnahmen` oder `Aktivität`.
- Wenn in einer Zeile Einnahmen und Ausgaben vorkommen, muss der Saldo sichtbar sein.
- Budgetfortschritt basiert auf `netConsumption`, nicht auf reinen Brutto-Ausgaben und nicht direkt auf `saldo`.
- Anteil an Ausgaben, Kreisdiagramme und Ausgaben-Rankings basieren auf `spending`, nicht auf `activity`.
- Sortierung nach Relevanz darf `activity` nutzen, muss aber die angezeigten Werte weiterhin getrennt ausweisen.

## Warum das wichtig ist

Ein Label wie `Urlaub` kann zum Beispiel enthalten:

- Ausgabe Hotel: 800 EUR
- Ausgabe Bahn: 160 EUR
- Einnahme Rückerstattung: 200 EUR

Die korrekten Werte sind:

- Einnahmen: 200 EUR
- Ausgaben: 960 EUR
- Saldo: -760 EUR
- Netto-Verbrauch: 760 EUR
- Aktivität: 1.160 EUR

Falsch wäre:

- `1.160 EUR Kosten`
- `960 EUR Saldo`
- `760 EUR Ausgaben`
- eine unbeschriftete `Summe 1.160 EUR`

Richtig wäre zum Beispiel:

- Hauptwert: `Saldo -760 EUR`
- Detail: `Einnahmen 200 EUR · Ausgaben 960 EUR`
- Budgetzeile: `760 EUR von Budget verbraucht`

## Anzeige-Regeln

### Zeitraum-KPIs

Auf Überblicksebene werden Zeitraumwerte so angezeigt:

- `Einnahmen`: `income`
- `Ausgaben`: `spending`
- `Saldo`: `saldo`
- `Budget übrig`: `monthlyBudget - spending`

Der Saldo darf positiv oder negativ sein. Negative Salden erhalten eine Warn-/Negativfarbe, positive Salden eine Positivfarbe.

### Kategoriezeilen

Kategoriezeilen haben zwei mögliche Anzeigezustände:

1. Nur Ausgaben:
   - Hauptwert: Ausgaben
   - Beispiel: `245,30 EUR`

2. Einnahmen und Ausgaben:
   - Hauptwert: Saldo
   - Detailzeile: Einnahmen und Ausgaben
   - Beispiel: `Saldo -180,00 EUR`
   - Detail: `Einnahmen 40,00 EUR · Ausgaben 220,00 EUR`

Wenn eine Kategorie nur Einnahmen enthält, wird sie ebenfalls als Saldo angezeigt:

- Hauptwert: `Saldo +120,00 EUR`
- Detail: `Einnahmen 120,00 EUR · Ausgaben 0,00 EUR`

### Labelzeilen

Für Labels gelten dieselben Regeln wie für Kategorien. Labels sind ausdrücklich keine reine Ausgaben-Dimension.

Wenn ein Label ein Budget hat, gilt:

- Budgetverbrauch: `netConsumption / budget`
- Budgetrest: `budget - netConsumption`
- Rückerstattungen und Auslagen-Erstattungen reduzieren den Budgetverbrauch
- Ein Einnahmenüberschuss reduziert den Budgetverbrauch maximal bis `0`

### Drilldown-Köpfe

Jede Detailansicht für Label, Kategorie, Händler oder Vertrag zeigt mindestens:

- Saldo
- Einnahmen
- Ausgaben
- Anzahl Einträge

Bei gemischten Daten darf der Drilldown nicht nur eine einzelne unbeschriftete Summe zeigen.

### Diagramme

Diagramme müssen klar benennen, welche Metrik sie zeigen.

Erlaubte Diagramm-Metriken:

- Ausgaben nach Kategorie: `spending`
- Einnahmen nach Kategorie: `income`
- Saldo nach Kategorie: `saldo`
- Aktivität nach Kategorie: `activity`

Kreisdiagramme sollten standardmäßig nur Ausgabenanteile zeigen, weil positive und negative Salden in Kreisdiagrammen missverständlich sind. Wenn Einnahmen oder Saldo visualisiert werden, braucht es einen anderen Diagrammtyp oder eine explizite Segmentierung.

## Budget-Logik

Budgets messen den budgetwirksamen Netto-Verbrauch einer Kategorie oder eines Labels. Das ist wichtig, weil Rückerstattungen und Auslagen sonst doppelt verwirren: Die Ausgabe ist real passiert, aber der endgültige Verbrauch ist niedriger.

Für Kategorie- und Labelbudgets gilt:

- `netConsumption = max(0, spending - income)`
- `budgetUsage = netConsumption / budget`
- `remaining = budget - netConsumption`
- `overBudget = netConsumption > budget`

Eine Rückerstattung oder Einnahme innerhalb derselben Kategorie oder desselben Labels reduziert den Budgetverbrauch. Die Brutto-Ausgaben bleiben trotzdem sichtbar, damit nachvollziehbar bleibt, was tatsächlich bezahlt wurde.

Beispiel:

- Budget `Urlaub`: 1.000 EUR
- Ausgaben: 960 EUR
- Rückerstattung: 200 EUR
- Saldo: -760 EUR
- Netto-Verbrauch: 760 EUR
- Budget übrig: 240 EUR

Wenn Einnahmen höher sind als Ausgaben:

- Ausgaben: 100 EUR
- Einnahmen: 150 EUR
- Saldo: +50 EUR
- Netto-Verbrauch: 0 EUR
- Budgetverbrauch: 0 EUR

Begründung: Das Budget soll den endgültigen Verbrauch zeigen. Die getrennte Anzeige von `spending`, `income` und `saldo` stellt sicher, dass Rückerstattungen nicht unsichtbar werden.

## Ranking-Logik

Je nach Ansicht gibt es unterschiedliche sinnvolle Sortierungen:

- Ausgabenranking: absteigend nach `spending`
- Einnahmenranking: absteigend nach `income`
- Saldo-Ranking: absteigend nach absolutem Saldo oder nach negativstem Saldo, je nach Fragestellung
- Aktivitätsranking: absteigend nach `activity`

Die Standardanalyse für Kategorien und Labels sollte nach `activity` oder `spending` sortieren, aber gemischte Werte immer mit Saldo plus Detailzeile anzeigen.

Empfehlung:

- Kategorie-Ausgabenübersicht: Sortierung nach `spending`
- Label-Übersicht: Sortierung nach `activity`, weil Labels oft Projekte oder Themen abbilden
- Drilldowns: Sortierung im Kopf nicht relevant, Eintragsliste nutzt gewählte Sortierung

## Vergleichslogik

Vergleiche müssen dieselbe Metrik auf beiden Seiten verwenden.

Beispiele:

- Kategorieausgaben 2026 vs. 2025: `spending(2026) - spending(2025)`
- Kategorie-Saldo 2026 vs. 2025: `saldo(2026) - saldo(2025)`
- Einnahmen 2026 vs. 2025: `income(2026) - income(2025)`

Die UI muss sichtbar machen, welche Metrik verglichen wird. Ein Delta ohne Metriklabel ist zu fehleranfällig.

## Prognose-Logik

Monatsprognosen werden nur für laufende Monate berechnet.

Grundform:

`projectedSpending = spendingSoFar / elapsedDays * daysInMonth`

Regeln:

- Die Prognose für Ausgaben basiert auf `spending`.
- Die Prognose für Einnahmen basiert auf `income`.
- Die Prognose für Saldo wird aus prognostizierten Einnahmen und Ausgaben berechnet.
- Der aktuelle Tag zählt als verstrichener Tag, wenn mindestens ein Teil des Tages vergangen ist.
- Bei sehr frühem Monat, zum Beispiel Tag 1-3, sollte die UI die Prognose als unsicher kennzeichnen.

## Normalwert-Logik

"Normal" sollte zunächst aus abgeschlossenen Monaten berechnet werden.

Empfehlung:

- Standardbasis: letzte 6 abgeschlossene Monate
- Mindestbasis: 3 abgeschlossene Monate
- Laufender Monat wird nicht in den Durchschnitt aufgenommen

Für eine Kategorie:

- `normalSpending = average(monthlySpending)`
- `currentSpending = spending im aktuellen Zeitraum`
- `delta = currentSpending - normalSpending`
- `deltaPercent = delta / normalSpending`

Wenn `normalSpending = 0`, darf keine Prozentabweichung angezeigt werden. Stattdessen kann die UI sagen: `Neu in diesem Zeitraum`.

## Belegabdeckung

Beleganalysen zählen Dokumentreferenzen, die mit Ausgaben oder Verträgen verknüpft sind.

Wichtige Werte:

- `documentedCount`
- `missingDocumentCount`
- `documentedSpending`
- `missingDocumentSpending`

Für Hinweise sollte ein Schwellwert gelten, damit kleine Alltagsausgaben die Ansicht nicht dominieren.

Vorschlag:

- Standardhinweis ab 100 EUR pro Ausgabe ohne Dokument
- Später konfigurierbar in Einstellungen

## Fixkosten und variable Kosten

Fixkosten sind Ausgaben, die aus Verträgen, wiederkehrenden Transaktionen oder klar markierten automatischen Quellen entstehen.

Mögliche Zuordnung:

- `generatedByContract = true`: Fixkosten
- `contractId != null`: Fixkosten
- `generatedByRecurringTransaction = true`: Fixkosten oder wiederkehrend, je nach Typ
- alle übrigen Ausgaben: variabel

Diese Zuordnung muss in der UI als Näherung verstanden werden. Eine spätere explizite Klassifikation wäre genauer.

Werte:

- `fixedSpending`
- `variableSpending`
- `fixedShare = fixedSpending / spending`
- `variableShare = variableSpending / spending`

Einnahmen werden in dieser Ansicht separat gezeigt und nicht mit Fixkosten verrechnet.

## Händler-Normalisierung

Für Händleranalysen kann kurzfristig der vorhandene Freitext `store` normalisiert werden.

Normalisierung:

- trimmen
- mehrfache Leerzeichen reduzieren
- Groß-/Kleinschreibung vereinheitlichen
- leere Werte als `Ohne Händler`

Keine aggressive Zusammenführung ohne Nutzerkontrolle. `REWE`, `REWE Center` und `REWE Online` dürfen zunächst getrennt bleiben, wenn keine Aliaslogik existiert.

## Testpflichten

Für Analytics-Logik sind Unit-Tests Pflicht, sobald neue Berechnungen eingeführt oder geändert werden.

Mindestens zu testen:

- Kategorie mit nur Ausgaben
- Kategorie mit nur Einnahmen
- Kategorie mit Einnahmen und Ausgaben
- Label mit nur Ausgaben
- Label mit nur Einnahmen
- Label mit Einnahmen und Ausgaben
- Budgetverbrauch nutzt `netConsumption`, nicht `spending` und nicht direkt `saldo`
- Budgetverbrauch wird bei Einnahmenüberschuss auf `0` begrenzt
- Ranking nach `spending` und nach `activity`
- Jahresvergleich nutzt die ausgewählte Metrik
- Prognose nutzt nur die passende Metrik
- Belegabdeckung zählt nur erlaubte/verknüpfte Dokumente

Regressionstest für den kritischen Fehler:

```text
Gegeben:
- Kategorie "Urlaub"
- Ausgabe 100,00 EUR
- Einnahme 40,00 EUR

Erwartet:
- income = 40,00 EUR
- spending = 100,00 EUR
- saldo = -60,00 EUR
- netConsumption = 60,00 EUR
- activity = 140,00 EUR
- sichtbarer Hauptwert bei gemischter Kategorie: Saldo -60,00 EUR
- Detailzeile zeigt Einnahmen 40,00 EUR und Ausgaben 100,00 EUR
- Budgetverbrauch basiert auf 60,00 EUR Netto-Verbrauch
```

## Implementierungsregeln

- Keine UI-Komponente soll Salden selbst aus Listen berechnen, wenn es dafür einen Analytics-Helfer gibt.
- Gemeinsame Berechnungen gehören nach `src/lib/expense-analytics.ts`.
- UI-View-Models sollen fertig berechnete Werte erhalten: `income`, `spending`, `saldo`, `netConsumption`, `activity`.
- Formatierung wie `formatMoney` passiert in der UI, nicht in der Berechnungslogik.
- Neue Analytics-Funktionen müssen reine Funktionen bleiben, damit sie ohne Datenbank testbar sind.
- Bei jeder neuen Darstellung muss entschieden und benannt werden, ob sie `income`, `spending`, `saldo` oder `activity` zeigt.

## Review-Checkliste

Vor dem Merge von Analytics-Änderungen prüfen:

- Werden Einnahmen und Ausgaben getrennt aggregiert?
- Wird `saldo = income - spending` berechnet?
- Wird `netConsumption = max(0, spending - income)` für Budgets genutzt?
- Sind gemischte Kategorien und Labels sichtbar korrekt?
- Gibt es irgendwo eine unbeschriftete `Summe`?
- Nutzt Budgetlogik wirklich `netConsumption`?
- Nutzt ein Diagramm negative oder gemischte Werte, ohne das zu erklären?
- Sind URL-Filter und Drilldowns nach Reload stabil?
- Decken Tests gemischte Einnahmen-/Ausgabenfälle ab?
