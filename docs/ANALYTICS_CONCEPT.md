# Analytics-Konzept

Dieses Konzept beschreibt, wie die Family App deutlich interaktiver und dynamischer werden kann, ohne die UI zu überladen. Der Leitgedanke ist: Analytics sollen nicht alles gleichzeitig zeigen, sondern den Nutzer schrittweise von einer klaren Zusammenfassung zu genaueren Antworten führen.

## Zielbild

Die Analytics werden zu einem ruhigen, hierarchischen Auswertungsbereich für Ausgaben, Einnahmen, Labels, Kategorien, Verträge, Dokumente und Zeiträume. Auf der ersten Ebene stehen nur wenige starke Signale. Jede Zahl, jedes Label und jede Kategorie kann bei Bedarf in eine fokussierte Detailansicht führen.

Die App bleibt mobile-first. Auf dem iPhone soll die erste Ansicht schnell verständlich sein, ohne breite Tabellen oder viele parallele Diagramme. Details werden über Tabs, Filterchips, Unterseiten, Bottom-Sheet-ähnliche Modals oder Drilldown-Ansichten geöffnet.

## Produktprinzipien

- Überblick vor Detail: Jede Analytics-Ansicht beginnt mit 2-4 starken Kennzahlen und einer kurzen Einordnung.
- Interaktion statt Dauerfläche: Klickbare Labels, Kategorien, Händler, Verträge und Zeiträume öffnen gefilterte Detailansichten.
- Eine Frage pro Bereich: Jede Unteransicht beantwortet eine klare Frage, statt mehrere Analyseideen zu mischen.
- Kontext bleibt erhalten: Zeitraum, Suche und Filter werden in der URL abgebildet und als Chips sichtbar gemacht.
- Keine zweite Buchhaltung: Analytics erklären vorhandene Daten, sie erzwingen keine komplizierten Zusatzfelder.
- Leise UI: Wenige Farben, kompakte Karten, Listen statt schwerer Diagrammflächen, progressive disclosure.
- Persönliche Sicherheit: Ausgaben bleiben pro Nutzer sichtbar, geteilte Bereiche respektieren bestehende Familien-/Privatlogik.

## Informationsarchitektur

Die Ausgaben-Seite sollte langfristig vier Hauptebenen haben.

1. **Monatscockpit**
   Zeigt den ausgewählten Zeitraum, Saldo, Ausgaben, Einnahmen, Budgetstatus und 1-3 Hinweise wie "Lebensmittel höher als sonst" oder "3 Belege fehlen".

2. **Analyse-Hub**
   Eine kompakte Navigation zu den wichtigsten Analysewegen:
   - Kategorien
   - Labels
   - Zeitverlauf
   - Verträge & Fixkosten
   - Händler & Zahlungsarten
   - Belege & Dokumente

3. **Drilldown-Ansichten**
   Fokussierte Unteransichten für einen gewählten Analyseknoten, zum Beispiel `/ausgaben/analyse/labels/:id` oder alternativ URL-gesteuert über `/ausgaben?label=...&view=analyse`.

4. **Eintragsliste**
   Die konkrete Liste bleibt der Beweisraum. Jede Analyse kann in "Einträge anzeigen" münden, mit denselben Filterchips und Sortierungen wie heute.

## Vorgeschlagene Navigation

### Erste Ebene: Ausgaben & Einnahmen

Die heutige Seite bleibt der Einstieg. Sie sollte oben keine große Analytics-Wand zeigen, sondern:

- Zeitraum-Navigation
- Suche und Filter
- KPI-Leiste mit Einnahmen, Ausgaben, Saldo, Budget/Prognose
- kompakte Bereichsnavigation

Bereichsnavigation:

- `Einträge`
- `Analyse`
- `Verlauf`
- `Hinweise`

`Einträge` bleibt standardmäßig offen, weil die App im Alltag oft zum Nachschauen und Erfassen genutzt wird. `Analyse` wird stärker, aber nicht dominanter.

### Zweite Ebene: Analyse

Die Analyse-Übersicht zeigt keine vollständigen Tabellen für alles. Sie zeigt kurze Module:

- Top-Kategorien: maximal 5 Zeilen, "Alle Kategorien" als Unteransicht.
- Top-Labels: maximal 5 Zeilen, "Alle Labels" als Unteransicht.
- Fixkosten/variable Kosten: 2-3 Kennzahlen.
- Auffälligkeiten: maximal 3 Hinweise.

Jede Zeile ist klickbar. Ein Klick auf ein Label öffnet die Label-Detailansicht. Ein Klick auf eine Kategorie öffnet die Kategorie-Detailansicht.

### Dritte Ebene: Drilldown

Jede Drilldown-Ansicht folgt demselben Muster:

- Kopf: Name, Zeitraum, Summe, Saldo, Anzahl Einträge.
- Mini-Trend: Verlauf für die letzten Monate.
- Aufschlüsselung: wichtigste Unterdimensionen.
- Einträge: gefilterte Liste.
- Aktionen: Export, Filter verfeinern, zurück zur Analyse.

Dadurch lernt die UI nur ein Muster, das für Labels, Kategorien, Verträge und Händler wiederverwendet werden kann.

## Interaktive Analysewege

### Label-Drilldown

Beispiel: Nutzer klickt auf das Label `Urlaub`.

Die Ansicht beantwortet:

- Was hat dieses Label im Zeitraum gekostet?
- Welche Kategorien stecken darin?
- In welchen Monaten fielen die Kosten an?
- Welche größten Einzelposten gehören dazu?
- Welche Belege fehlen?

Empfohlene Struktur:

- Header: `Label: Urlaub`
- KPI-Zeile: Ausgaben, Einnahmen, Saldo, Einträge
- Verlauf: kleine Monatsreihe
- Kategorien im Label: kompakte Liste
- Größte Einträge: Top 5
- Alle Einträge: gefilterte Liste mit "Mehr laden"

URL-Strategie:

- Kurzfristig: `/ausgaben?label=<id>&view=analyse`
- Langfristig: `/ausgaben/analyse/labels/<id>?month=2026-07`

### Kategorie-Drilldown

Beispiel: Nutzer klickt auf `Lebensmittel`.

Die Ansicht beantwortet:

- Wie entwickelt sich die Kategorie im Vergleich zu normalen Monaten?
- Welche Händler treiben die Summe?
- Wie steht die Kategorie zum Budget?
- Welche Labels kommen in dieser Kategorie häufig vor?

Module:

- Budgetfortschritt
- Monatsvergleich
- Händlerliste
- Labelverteilung
- Eintragsliste

### Händler-Drilldown

Händler sind keine eigene Verwaltungsstruktur, aber als Analysefacette sehr wertvoll.

Beispiele:

- `REWE`: Ausgaben nach Monat, häufige Kategorien, Durchschnitt pro Einkauf.
- `Amazon`: größte Posten, Labels, Belege.
- `Tankstelle`: Verbindung zu Kilometer/Tankstopps.

Kurzfristig reicht eine normalisierte Store-Auswertung aus vorhandenen Ausgaben. Eine eigene Händler-Tabelle ist erst nötig, wenn Alias-Zusammenführung wie `Rewe`, `REWE Markt`, `Rewe Center` gewünscht ist.

### Zeitverlauf

Der Verlauf beantwortet nicht nur "wie viel", sondern "was hat sich verändert".

Ansichten:

- Monatlich: aktueller Monat plus letzte 12 Monate.
- Jährlich: Jahre nebeneinander.
- Saisonvergleich: aktueller Monat gegen denselben Monat im Vorjahr.

Interaktion:

- Klick auf einen Monat filtert die Eintragsliste.
- Klick auf eine Kategorie im Verlauf öffnet den Kategorie-Drilldown für diesen Zeitraum.
- Umschalter: Ausgaben, Einnahmen, Saldo.

### Verträge & Fixkosten

Diese Ansicht trennt beeinflussbare variable Kosten von laufenden Verpflichtungen.

Module:

- Fixkosten pro Monat
- variable Kosten im Zeitraum
- automatisch erzeugte Vertragsausgaben
- Verträge mit Preisänderungen
- nächste Kündigungs-/Verlängerungstermine

Der Nutzen ist besonders hoch, weil Nutzer sonst in Gesamtausgaben schwer erkennen, was sie wirklich kurzfristig steuern können.

### Belege & Dokumente

Analytics sollten auch Datenqualität sichtbar machen.

Module:

- Ausgaben über Schwellwert ohne Dokument
- Verträge ohne Dokument
- Dokumentierte vs. undokumentierte Summe
- Belege je Kategorie oder Label

Das ist kein Kontrollbereich, sondern ein Sicherheitsnetz für Steuer, Garantie und Nachvollziehbarkeit.

## Dynamische Hinweise

Hinweise sollten klein, konkret und klickbar sein. Keine langen Texte, keine Alarmoptik.

Geeignete Hinweise:

- `Lebensmittel liegen 34% über dem 6-Monats-Schnitt.`
- `3 Ausgaben über 100 EUR haben keinen Beleg.`
- `Streaming ist seit März um 6 EUR teurer.`
- `Auto-Kosten sind diesen Monat hauptsächlich Tankstopps.`
- `Dieses Label wurde lange nicht genutzt.`
- `Mögliche doppelte Ausgabe gefunden.`

Hinweis-Regeln:

- Maximal 3 Hinweise auf der Überblicksebene.
- Jeder Hinweis führt zu einer Detailansicht oder gefilterten Eintragsliste.
- Hinweise müssen erklärbar sein: "verglichen mit Durchschnitt der letzten 6 abgeschlossenen Monate".
- Keine versteckte KI-Blackbox für finanzielle Aussagen. Heuristiken sind ausreichend.

## UI-Muster

### Kompakte KPI-Karten

KPI-Karten zeigen nur eine Hauptzahl und optional eine zweite Zeile.

Beispiele:

- `Ausgaben` / `1.240,20 EUR`
- `Saldo` / `+420,00 EUR`
- `Prognose` / `ca. 1.890 EUR`
- `Belege` / `8 fehlen`

### Klickbare Analysezeilen

Kategorie- und Labelzeilen sollten wie Navigationszeilen wirken:

- Farbindikator links
- Name und kleine Kontextzeile
- Betrag rechts
- dezenter Pfeil oder Chevron

Keine permanent aufgeklappten Detailblöcke in jeder Zeile.

### Segmentierte Ansichten

Innerhalb von Analytics eignen sich Segmentierungen:

- `Kategorien | Labels | Verlauf | Fixkosten`
- In Drilldowns: `Überblick | Einträge | Belege`

Auf Mobile können diese als horizontal scrollbare Chips dargestellt werden.

### Filterchips

Aktive Filter bleiben oben sichtbar:

- `Juli 2026`
- `Label: Urlaub`
- `Kategorie: Auto`
- `Suche: Rechnung`

Jeder Chip ist einzeln entfernbar. "Alle löschen" bleibt sekundär.

### Bottom-Sheet/Modal für Detailfilter

Komplexere Filter bleiben hinter `Filter`. Beispiele:

- Zeitraum frei wählen
- Mindestbetrag
- Zahlungsart
- Belegstatus
- automatisch/manuell erzeugt

## Daten- und URL-Konzept

Die aktuelle App hat bereits eine gute Basis mit URL-Parametern für Zeitraum, Suche, Kategorie und Label. Das sollte erweitert werden, ohne sofort neue Datenbanktabellen zu erzwingen.

Kurzfristige Parameter:

- `view=entries|analysis|trend|insights`
- `label=<id>`
- `category=<id>`
- `store=<normalized-store>`
- `contract=<id>`
- `document=missing|present`
- `kind=expense|income|all`

Später mögliche Routen:

- `/ausgaben/analyse`
- `/ausgaben/analyse/labels/[labelId]`
- `/ausgaben/analyse/kategorien/[categoryId]`
- `/ausgaben/analyse/haendler/[storeKey]`
- `/ausgaben/analyse/vertraege`
- `/ausgaben/analyse/belege`

Empfehlung: erst URL-Parameter erweitern, dann bei wachsender Komplexität echte Unterrouten einführen. So bleibt die erste Implementierung klein und nutzt vorhandene Filterlogik.

## Technische Bausteine

Die fachliche Berechnungslogik ist in `docs/ANALYTICS_LOGIC.md` verbindlich beschrieben. Besonders wichtig: Kategorien und Labels können sowohl Einnahmen als auch Ausgaben enthalten. Analytics müssen deshalb immer `income`, `spending`, `saldo = income - spending` und `netConsumption = max(0, spending - income)` getrennt berechnen. Gemischte Werte dürfen nie als einfache Betragssumme ausgegeben werden. Budgets nutzen den Netto-Verbrauch, damit Rückerstattungen und Auslagen-Erstattungen den Budgetverbrauch korrekt reduzieren.

### Analyse-Helfer

`src/lib/expense-analytics.ts` sollte schrittweise zu einem klaren Analysemodul wachsen:

- Kategoriezeilen
- Labelzeilen
- Periodenzeilen
- Store-Zeilen
- Fixkosten-/Variabel-Split
- Belegabdeckung
- Vergleich gegen Durchschnitt
- Prognose für laufenden Monat
- Hinweis-Generator

Die Funktionen sollten reine Datenfunktionen bleiben und gut testbar sein.

### Wiederverwendbare UI-Komponenten

Sinnvolle Komponenten:

- `AnalyticsKpiStrip`
- `AnalyticsNav`
- `AnalyticsRow`
- `AnalyticsInsightList`
- `AnalyticsDrilldownHeader`
- `TrendSparkline`
- `FilteredExpenseListSection`

Diese Komponenten sollten keine Businesslogik kennen, sondern vorbereitete View-Models rendern.

### Eintragsliste als gemeinsamer Endpunkt

Jede Analyse endet in derselben Eintragsliste. Damit bleibt die Bedienlogik vertraut und die App wirkt nicht wie mehrere getrennte Reports.

## Priorisierung

### Phase 1: Interaktive Grundlagen

Ziel: Bestehende Analytics besser strukturieren und klickbar machen.

- Analyse-Übersicht in kompakte Module aufteilen.
- Kategorie- und Labelzeilen klickbar machen.
- Label-Drilldown über vorhandenen `label`-Filter und `view=analysis`.
- Kategorie-Drilldown über vorhandenen `category`-Filter und `view=analysis`.
- Aktive Filterchips prominenter und konsistenter nutzen.
- Tests für URL-Filter und Analytics-Helfer ergänzen.

Nutzen: Sofort spürbar interaktiver, wenig Risiko, keine Schemaänderung.

### Phase 2: Mehr Erklärung

Ziel: Die App erklärt, warum ein Zeitraum auffällig ist.

- Monatsprognose.
- Vergleich gegen 3-/6-Monats-Schnitt.
- Top-Veränderungen pro Kategorie/Label.
- Dynamische Hinweise mit maximal 3 Einträgen.
- Belegabdeckung für Ausgaben und Verträge.

Nutzen: Analytics werden entscheidungsnützlich, nicht nur rückblickend.

### Phase 3: Neue Analysefacetten

Ziel: Mehr Alltagssichten ohne UI-Überladung.

- Händleranalyse aus `store`.
- Zahlungsartenanalyse.
- Fixkosten vs. variable Kosten.
- Vertragskosten und Preisänderungen.
- Verbindung zu Kilometerdaten für Auto-/Tankkosten.

Nutzen: Bessere Mustererkennung und echte Haushaltssteuerung.

### Phase 4: Eigene Analyse-Unterseiten

Ziel: Struktur stabilisieren, sobald die Analysefläche wächst.

- Eigene Routen für Labels, Kategorien, Händler und Belege.
- Gemeinsames Drilldown-Layout.
- Deep Links aus Dashboard, Dokumenten und Verträgen.
- Optional gespeicherte Analyseansichten.

Nutzen: Mehr Tiefe, ohne die Hauptseite aufzublähen.

## Beispiel-Nutzerfluss

1. Nutzer öffnet `Ausgaben & Einnahmen`.
2. Oben sieht er: `Ausgaben 1.240 EUR`, `Saldo +420 EUR`, `Prognose normal`, `2 Hinweise`.
3. In der Analyse sieht er `Labels` mit `Urlaub`, `Kind`, `Haus`.
4. Er tippt auf `Urlaub`.
5. Die App zeigt `Label: Urlaub` mit Summe, Monatsverlauf, Kategorien und Einträgen.
6. Er tippt auf `Belege fehlen`.
7. Die Eintragsliste zeigt nur Urlaubsausgaben ohne Dokument.

Dieser Ablauf ist tief, aber nicht voll: jede Ebene zeigt nur die nächste relevante Entscheidung.

## Akzeptanzkriterien

- Die Ausgaben-Hauptseite bleibt auf Mobile ohne horizontales Scrollen nutzbar.
- Die erste Analytics-Ebene zeigt maximal 2-4 KPI-Karten und kompakte Module.
- Kategorie- und Labelzeilen sind als Navigation erkennbar.
- Ein Klick auf ein Label oder eine Kategorie führt zu einer gefilterten, verständlichen Detailansicht.
- Filterzustand ist per URL teilbar und nach Reload erhalten.
- Die Eintragsliste bleibt der gemeinsame Detail-Endpunkt.
- Keine Analyseansicht zeigt mehrere große Tabellen direkt untereinander.
- Hinweise sind begrenzt, erklärbar und klickbar.
- Bestehende Imports, Exports, Dokumentzugriffe, Vertragsautomatik und globale Erstellung bleiben unverändert.

## Offene Entscheidungen

- Sollen Drilldowns zunächst auf derselben Seite per `view`-Parameter laufen oder direkt als eigene Unterrouten?
- Soll die Analyse standardmäßig nach persönlichen Ausgaben filtern oder explizit zwischen `Meine Daten` und `Familie` unterscheiden, wo die Sichtbarkeit es erlaubt?
- Ab welchem Betrag gilt ein fehlender Beleg als Hinweis?
- Welche Zeitbasis ist für "normal" am sinnvollsten: 3, 6 oder 12 abgeschlossene Monate?
- Sollen Händler-Aliase manuell gepflegt werden oder reicht zunächst Normalisierung aus dem Freitext?

## Empfehlung

Als nächster Umsetzungsschritt bietet sich Phase 1 an: die bestehende Ausgaben-Analytics visuell neu ordnen, Label- und Kategoriezeilen klickbar machen und fokussierte Drilldown-Zustände per URL einführen. Das liefert den gewünschten interaktiven Charakter, bleibt nah an der aktuellen Datenstruktur und verhindert, dass die Hauptseite zu einem überladenen Report wird.
