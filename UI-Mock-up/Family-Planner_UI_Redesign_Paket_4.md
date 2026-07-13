# Family Planner – UI-Redesign Paket 4

Status: abgestimmte Design- und Interaktionsgrundlage für die spätere Implementierung  
Abhängigkeiten: `Family-Planner_UI_Redesign_Paket_1.md`, `Family-Planner_UI_Redesign_Paket_2.md` und `Family-Planner_UI_Redesign_Paket_3.md` sind vollständig verbindlich.  
Geltungsbereich: Mobile Finanzbuchung erstellen, Buchungsdetails, Finanzfilter und wiederkehrende Buchungen.

## 1. Einordnung

Das UI-Redesign wird in neun Paketen entwickelt. Paket 4 überträgt das in Paket 3 definierte Sheet- und Flow-System auf die Finanzfunktionen.

Zentrale Entscheidungen dieses Pakets:

- einzelne und wiederkehrende Buchungen gehören zu einem zusammenhängenden Erstellen-Konzept;
- eine bestehende Buchung wird zunächst lesend geöffnet;
- Filter sind ein unabhängiges Sheet und werden nicht mit Suche oder Erstellen gestapelt;
- alle Paket-4-Sheets verwenden eine annähernd identische Außenhöhe;
- unterschiedlich lange Inhalte scrollen innerhalb des Sheets;
- auswählbare oder erweiterbare Stammdaten werden über ein einheitliches Combobox-/Dropdown-Muster bedient;
- finale Hauptmockups zeigen Dropdowns im geschlossenen Standardzustand;
- geöffnete Picker und Quick-Add-Zustände werden schriftlich und später im Komponentenvertrag spezifiziert.

Die schriftliche Spezifikation definiert Funktion und Verhalten. Das finale Mockup definiert visuelle Hierarchie, Proportionen und Atmosphäre. Bei Konflikten hat die schriftliche Spezifikation Vorrang.

## 2. Weitergeltende globale Regeln

Aus Paket 1–3 gelten insbesondere:

- Referenzviewport `390 × 844 px`;
- neutraler, geometrischer und konsistent gerundeter Stil;
- identischer App-Shell;
- eingeklappte Suche im Standardzustand;
- lokal gebündelte Outline-Icons;
- keine Profilbilder oder externen Markenassets;
- ein Sheet pro Interaktion und niemals gestapelte Sheets;
- ausgeblendeter FAB bei geöffnetem Sheet;
- gesperrter und abgedunkelter Hintergrund;
- sticky Sheet-Header und -Footer, wo sinnvoll;
- bestehende Server Actions, Rechte, Automatisierungen und Offline-Hooks bleiben erhalten.

## 3. Verbindliche vier Referenzscreens

Paket 4 umfasst:

1. einzelne Buchung erstellen;
2. bestehende Buchung ansehen;
3. Finanzen filtern;
4. wiederkehrende Buchung konfigurieren.

Diese Screens sind keine lineare Vier-Schritt-Sequenz. Sie gehören zu drei getrennten Flows:

- Flow A: einzelne oder wiederkehrende Buchung erstellen;
- Flow B: bestehende Buchung ansehen/bearbeiten;
- Flow C: Finanzdaten filtern.

## 4. Gemeinsame Sheet-Geometrie

### 4.1 Einheitliche Außenhöhe

Alle Paket-4-Sheets:

- beginnen auf derselben oder nahezu derselben vertikalen Position, ungefähr 18–20 % unterhalb des oberen Viewportrands;
- enden bündig am unteren Safe-Area-Rand;
- besitzen dieselben oberen Radien;
- richten Drag-Handle, Header und Footer an gemeinsamen Baselines aus;
- verändern ihre Außenhöhe nicht abhängig von einem geöffneten Feld.

### 4.2 Interner Scroll

- Sheet-Header bleibt sichtbar;
- Formular-/Detailinhalt scrollt intern;
- Footer bleibt erreichbar und darf sticky sein;
- Bildschirmtastatur darf keine aktiven Felder oder Aktionen verdecken;
- Scrollposition wird beim Öffnen eines Pickers sinnvoll angepasst.

### 4.3 Standardzustand im Mockup

Finale Hauptmockups zeigen:

- geschlossene Dropdowns/Comboboxen;
- keine offene Auswahlliste;
- keine Tastatur;
- keine Validierungsfehler;
- keine gleichzeitige Suche und Filterauswahl.

Dadurch bleibt das Formular als Ganzes beurteilbar. Geöffnete Zustände gehören zur Komponenten- und Interaktionsspezifikation, nicht zwingend in das Paket-Übersichtsbild.

## 5. Auswahlfelder und erweiterbare Stammdaten

### 5.1 Unterscheidung der Controls

#### Segmented Control

Für kleine, fest definierte und nicht erweiterbare Mengen:

- Ausgabe/Einnahme;
- Monat/Jahr/eigener Zeitraum, soweit passend;
- Alle/Ausgaben/Einnahmen.

#### Dropdown/Combobox

Für Daten, deren Liste länger, durchsuchbar oder erweiterbar ist:

- Kategorie;
- Zahlungsart;
- Label/Projekt;
- Vertrag;
- Quelle im Filter;
- Zahlungsrhythmus;
- Fälligkeitstyp;
- weitere benutzerdefinierbare Stammdaten.

### 5.2 Geschlossener Zustand

Einheitliches Muster:

```text
Kategorie *
[ lokales Icon  Restaurant                      ▾ ]
```

Oder ohne Auswahl:

```text
Kategorie *
[ Kategorie auswählen                          ▾ ]
```

Regeln:

- Down-Chevron für Auswahlfelder;
- Right-Chevron nur für einen Wechsel in einen neuen Flow-Schritt;
- gleiche Feldhöhe und Radien;
- aktueller Wert oder klarer Placeholder;
- optional lokales Outline-Icon;
- keine frei erfundenen Markenlogos.

### 5.3 Geöffneter Zustand

Beim Öffnen erscheint eine Auswahlliste innerhalb des aktuellen Sheet-Kontexts. Es wird kein weiteres Modal gestapelt.

Mögliche Elemente:

- Suchfeld;
- vorhandene Optionen;
- lokale Icons und Text;
- ausgewählter Zustand;
- letzte Aktion `+ Neu hinzufügen`.

Beispiel Kategorie:

```text
Kategorie suchen …

Nahrung
Restaurant
Auto
Gebühren

+ Neue Kategorie hinzufügen
```

### 5.4 Quick Add

`+ Neue Kategorie hinzufügen` beziehungsweise `+ Neue Zahlungsart hinzufügen` wechselt innerhalb desselben Sheets in eine kompakte Unteransicht.

- kein neues Sheet;
- Zurück-Pfeil führt zur Auswahl;
- bereits ausgefüllte Buchungsdaten bleiben erhalten;
- nach erfolgreicher Anlage wird der neue Wert automatisch ausgewählt;
- Abbruch kehrt ohne Datenverlust zurück.

### 5.5 Technische Datenmodelle

Die UI darf Erweiterbarkeit nicht vortäuschen, wenn die Daten technisch nicht dauerhaft strukturiert gespeichert werden können.

- Kategorien besitzen bereits ein eigenes Datenmodell und können regulär angelegt werden.
- Labels besitzen ein eigenes Datenmodell.
- Verträge sind bestehende Entitäten.
- Zahlungsart ist aktuell ein Stringfeld. Eine Quick-Add-Auswahl kann bestehende Werte aus bisherigen Buchungen vorschlagen und einen neuen Textwert übernehmen, ohne zwingend sofort ein neues Datenmodell einzuführen.
- Wenn später eine zentrale Zahlungsartenverwaltung gewünscht ist, ist dies eine separate fachliche Erweiterung.

## 6. Gesamtlogik der Finanzflows

### 6.1 Flow A – Buchung erstellen

```text
Finanzübersicht
→ globaler Plus-Button
→ globales „Neu erstellen“
→ Buchung
→ Buchung erstellen
├─ einzelne Buchung speichern
└─ als wiederkehrende Buchung planen
   → Details
   → Wiederholung
   → Serie speichern
```

Der Wechsel zur Serie erfolgt im selben Sheet-Zustand und übernimmt bereits eingegebene Werte.

### 6.2 Flow B – Buchung ansehen

```text
Eintragsliste
→ Buchung antippen
→ Buchungsdetails
├─ Bearbeiten
│  → Bearbeitungsmodus im selben Sheet
│  → Speichern
├─ Duplizieren
│  → Erstellen-Sheet mit vorausgefüllten Werten
└─ Overflow
   → Löschen, soweit zulässig
```

Beim Duplizieren wird das Detail-Sheet nicht mit einem zweiten Sheet überlagert. Es erfolgt ein kontrollierter Zustandswechsel.

### 6.3 Flow C – Filter

```text
Finanzübersicht oder Eintragsliste
→ Filter-Icon
→ Finanzfilter-Sheet
→ Filter anwenden
→ Sheet schließen
→ gefilterte Ansicht
```

## 7. Screen 1 – Buchung erstellen

### 7.1 Nutzerfrage

Wie erfasse ich eine Einnahme oder Ausgabe schnell und korrekt?

### 7.2 Einstieg

Globaler Plus-Button → `Buchung`.

### 7.3 Art der Buchung

Kompaktes Segmented Control:

```text
Ausgabe | Einnahme
```

Die Auswahl beeinflusst Vorzeichen, semantische Farbe und spätere Auswertung. Der Nutzer gibt den Betrag ohne negatives Vorzeichen ein.

### 7.4 Sofort sichtbare Felder

- Beschreibung, erforderlich;
- Betrag, erforderlich;
- Datum, erforderlich;
- Kategorie, erforderlich oder gemäß bestehender Validierung;
- Zahlungsart.

Beispiel:

```text
Beschreibung *
z. B. Supermarkt, Restaurant …

Betrag *          Datum *
0,00 €            11.07.2026

Kategorie *
[ Kategorie auswählen ▾ ]

Zahlungsart
[ Karte ▾ ]
```

### 7.5 Weitere Optionen

Eingeklappter Bereich:

- Geschäft/Anbieter;
- Label/Projekt;
- Vertrag;
- Sichtbarkeit;
- gegebenenfalls weitere bestehende optionale Felder.

### 7.6 Serie

Eine ruhige Aktionszeile:

```text
Als wiederkehrende Buchung planen →
```

Right-Chevron ist hier korrekt, weil ein neuer Schritt des Flows geöffnet wird.

### 7.7 Footer

- Abbrechen;
- Buchung speichern.

## 8. Screen 2 – Buchungsdetails

### 8.1 Nutzerfrage

Welche Informationen gehören zu dieser Buchung und welche Aktion kann ich ausführen?

### 8.2 Einstieg

Nutzer tippt einen Eintrag in der Finanzliste. Das Sheet öffnet lesend.

### 8.3 Zusammenfassung

- lokales Kategorie-Icon;
- Beschreibung;
- formatierter Betrag mit Einnahme-/Ausgabenkennzeichnung;
- Datum.

### 8.4 Metadaten

- Kategorie;
- Zahlungsart;
- Geschäft;
- Label/Projekt;
- Sichtbarkeit;
- Quelle;
- Vertragsverknüpfung;
- Ersteller und gegebenenfalls Aktualisierung.

Quelle unterscheidet beispielsweise:

- manuell;
- Vertrag;
- Tankstopp;
- Serie.

### 8.5 Aktionen

- Bearbeiten;
- Duplizieren;
- Löschen nur im Overflow.

Bearbeiten wechselt dasselbe Sheet in den Formularmodus. Automatisch erzeugte Einträge dürfen nur im Rahmen der bestehenden Regeln geändert werden.

## 9. Screen 3 – Finanzfilter

### 9.1 Nutzerfrage

Welche Teilmenge der Finanzdaten möchte ich sehen?

### 9.2 Suche als Kontext

Ist eine Suche aktiv, erscheint nur:

```text
Aktive Suche: Rewe
```

Kein zweites Suchfeld im Filter.

### 9.3 Zeitraum

Kompakte Modi:

- Monat;
- Jahr;
- eigener Zeitraum.

Monat/Jahr bleiben auch Teil der regulären Finanznavigation. Der Filter ergänzt vor allem einen individuellen Zeitraum und eine gebündelte Filterbearbeitung.

### 9.4 Art

- Alle;
- Ausgaben;
- Einnahmen.

### 9.5 Auswahlfelder

Geschlossene Comboboxen:

- Kategorie;
- Label/Projekt;
- Zahlungsarten;
- Quellen.

Mehrfachauswahl wird kompakt zusammengefasst:

```text
Zahlungsarten
[ Karte +1 ▾ ]

Quellen
[ Manuell, Vertrag ▾ ]
```

### 9.6 Footer

- Zurücksetzen;
- `24 Einträge anzeigen` oder `Filter anwenden`.

Trefferzahl nur anzeigen, wenn sie verlässlich berechnet werden kann.

## 10. Screen 4 – wiederkehrende Buchung

### 10.1 Nutzerfrage

Wie soll eine Buchung zukünftig automatisch erzeugt werden?

### 10.2 Zusammenhang mit Erstellen

Der Nutzer kommt aus `Buchung erstellen`. Das Sheet bleibt dasselbe und wechselt in den Serienmodus.

Navigation:

```text
Details | Wiederholung
```

`Details` enthält die gemeinsamen Buchungsinformationen. `Wiederholung` enthält Zeit- und Preisregeln.

### 10.3 Zusammenfassung

Kompakte Darstellung der bereits erfassten Angaben, z. B.:

```text
Fitnessstudio
−29,90 € · Gebühren
```

### 10.4 Wiederholungsfelder

- Zahlungsrhythmus als Dropdown;
- Fälligkeit als Dropdown;
- Startdatum;
- optionales Enddatum.

Unterstützte Zahlungsrhythmen orientieren sich am bestehenden Modell:

- monatlich;
- vierteljährlich;
- jährlich;
- einmalig, soweit im Serienkontext sinnvoll;
- sonstig nur, wenn fachlich unterstützt.

### 10.5 Preisphase

- Betrag;
- `Preis gilt ab`;
- kurzer Hilfetext, dass spätere Preisänderungen eine neue Preisphase erzeugen.

Preisphasen sind keine Vertragskündigungslogik. Vertragsfelder wie Kündigungsfrist oder automatische Verlängerung erscheinen hier nicht.

### 10.6 Footer

- Zurück;
- Serie speichern.

Zurück erhält alle Eingaben.

## 11. Kategorien, Labels und Zahlungsarten hinzufügen

### 11.1 Kategorie

Quick Add enthält mindestens:

- Name;
- lokal gebündeltes Icon;
- Farbe;
- Sichtbarkeit;
- optionales Monatsbudget gemäß bestehendem Modell.

Für eine wirklich schnelle Anlage kann zuerst nur der Name erforderlich sein; weitere Darstellungseinstellungen erhalten sinnvolle lokale Defaults und sind später editierbar.

### 11.2 Label/Projekt

Quick Add enthält:

- Name;
- Farbe;
- optionales Budget.

### 11.3 Zahlungsart

Da Zahlungsart aktuell als String gespeichert wird:

- vorhandene Werte werden aus bisherigen Daten vorgeschlagen;
- Nutzer kann einen neuen Textwert erfassen;
- dieser Wert wird für die aktuelle Buchung gespeichert und künftig vorgeschlagen;
- keine separate zentrale Verwaltung wird ohne zusätzlichen Auftrag vorausgesetzt.

## 12. Validierung und Beträge

- deutsche Dezimalformate akzeptieren;
- Nutzer gibt positive Beträge ein, Art bestimmt Einnahme/Ausgabe;
- Betrag größer als null;
- Datum erforderlich;
- erforderliche Felder inline markieren;
- Fehler erhalten Eingaben und Sheet-Zustand;
- Doppelsubmits verhindern;
- Pending-Zustand auf Primäraktion;
- Geldwerte mit tabellarischen Ziffern darstellen.

## 13. Automatisch erzeugte Einträge

Die Detailansicht kennzeichnet klar, wenn eine Buchung stammt aus:

- Vertrag;
- Tankstopp;
- wiederkehrender Serie.

Bearbeiten und Löschen müssen bestehende Verknüpfungs- und Automatisierungsregeln respektieren. Das UI darf eine Quelle nicht stillschweigend in eine manuelle Buchung umwandeln.

## 14. Offline-Verhalten

Bestehende Offline-Erstellung neuer Ausgaben muss erhalten bleiben.

- lokale Annahme klar kommunizieren;
- ausstehende Synchronisierung nicht als bestätigten Serverzustand darstellen;
- keine wiederkehrende Serie offline speichern, falls die bestehende Sync-Logik dies nicht unterstützt;
- Combobox-Optionen müssen offline aus lokal verfügbaren Daten funktionieren;
- Quick Add nur offline anbieten, wenn die entsprechende Entität synchronisiert werden kann.

## 15. Accessibility

- ungefähr 44-px-Touchziele;
- sichtbare Fokuszustände;
- korrektes Dialog-/Sheet-Fokusmanagement;
- Comboboxen mit zugänglichem Namen, Zustand und Ergebnisliste;
- Auswahl nicht nur über Farbe darstellen;
- Screenreader-Text für Betragsart und Vorzeichen;
- Down-/Right-Chevrons semantisch korrekt verwenden;
- reduzierte Bewegung respektieren.

## 16. Explizite Nicht-Ziele von Paket 4

- keine vollständige Kategorie-/Label-Setupseite;
- kein finales globales Erstellen-Menü;
- keine Vertrags-Preis- oder Kündigungslogik;
- keine neue Zahlungsarten-Datenbank ohne separaten Auftrag;
- keine komplexe Serienbearbeitung bestehender erzeugter Einträge;
- keine Desktop-Dialoge;
- keine geöffneten Dropdowns im finalen Vierer-Hauptmockup;
- keine gestapelten Sheets.

## 17. Implementierungsregeln für Codex

1. Paket 1–3 und danach Paket 4 vollständig lesen.
2. Den gemeinsamen Sheet-Primitive aus Paket 3 weiterverwenden.
3. Paket-4-Sheets auf eine gemeinsame Außenhöhe standardisieren.
4. Lange Inhalte intern scrollen lassen.
5. Einen gemeinsamen Combobox-/Dropdown-Primitive verwenden.
6. Down-Chevron nur für Auswahl, Right-Chevron nur für Flow-Navigation.
7. Quick Add innerhalb desselben Sheet-Kontexts implementieren.
8. Buchungsdaten beim Wechsel zur Serie erhalten.
9. Detailansicht zunächst lesend darstellen.
10. Suche und Filter nicht duplizieren oder stapeln.
11. Bestehende Datenmodelle, Feldnamen, Server Actions, Quellenverknüpfungen und Offline-Hooks erhalten.
12. Keine fachliche Erweiterbarkeit vortäuschen, die technisch nicht gespeichert werden kann.
13. Auf 390 × 844 px Sheet, Tastatur, Dropdown, Scroll und Footer testen.
14. Keine ungeordnete globale CSS-Override-Schicht hinzufügen.

## 18. Akzeptanzkriterien

Paket 4 ist implementierungsseitig erfüllt, wenn:

- alle vier Sheets dieselbe oder nahezu dieselbe Außenhöhe besitzen;
- alle Sheets am unteren Safe-Area-Rand enden;
- längere Inhalte intern scrollen;
- der FAB bei geöffnetem Sheet ausgeblendet ist;
- Kategorie, Zahlungsart, Label, Vertrag und ähnliche Daten konsistente Comboboxen verwenden;
- finale Hauptzustände geschlossene Dropdowns zeigen;
- Picker Suche und `+ Neu hinzufügen` unterstützen, wo fachlich möglich;
- Quick Add kein zweites Sheet stapelt;
- neu angelegte Werte automatisch ausgewählt werden;
- einzelne und wiederkehrende Buchung einen zusammenhängenden Flow bilden;
- Detailansicht lesend startet und im selben Sheet bearbeitbar ist;
- Filter Suche nur als Kontext zusammenfasst;
- automatisch erzeugte Quellen klar gekennzeichnet bleiben;
- bestehende Offline- und Automatisierungslogik nicht beschädigt wird;
- keine Markenlogos oder externen Icons verwendet werden;
- Tastatur und Footer keine Felder verdecken;
- kein horizontaler Overflow bei 390 px entsteht.

## 19. Offene Punkte für spätere Pakete

- finale globale Combobox- und Quick-Add-Komponentenverträge;
- vollständige Kategorie-/Label-Verwaltung;
- Bearbeitung bestehender Serien und zukünftiger Preisphasen;
- Konfliktbehandlung bei automatisch erzeugten Einträgen;
- globale Feedback- und Toast-Logik;
- Desktop-Darstellung der gleichen Flows.

