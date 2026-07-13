# Family Planner – UI-Redesign Paket 3

Status: abgestimmte Design- und Interaktionsgrundlage für die spätere Implementierung  
Abhängigkeiten: `Family-Planner_UI_Redesign_Paket_1.md` und `Family-Planner_UI_Redesign_Paket_2.md` sind vollständig verbindlich.  
Geltungsbereich: Mobile Aufgaben-Erstellung, wiederkehrende Aufgaben, Aufgabendetails sowie Suche und Filter.

## 1. Einordnung

Das UI-Redesign wird in neun Paketen entwickelt. Paket 3 spezifiziert erstmals zusammenhängende Erstellen-, Detail- und Filterinteraktionen.

Die zentrale Korrektur gegenüber dem ersten Paket-3-Mockup lautet:

- die gezeigten Sheets sind keine vier gleichwertigen Pop-ups;
- einmalige und wiederkehrende Aufgaben gehören zu einem gemeinsamen Erstellen-Flow;
- wiederkehrende Aufgaben werden schrittweise innerhalb desselben Sheets konfiguriert;
- eine bestehende Aufgabe besitzt einen davon unabhängigen Detail-/Bearbeitungsflow;
- Suche ersetzt temporär den Seitentitel und öffnet kein Sheet;
- Filter öffnet ein eigenständiges Sheet;
- Sheets werden niemals übereinander gestapelt.

Die schriftliche Spezifikation ist funktional verbindlich und überschreibt die unklare Abfolge im ersten Mockup. Das Mockup bleibt Referenz für Stil, Abstände, Formensprache, Sheet-Darstellung und visuelle Hierarchie.

## 2. Weitergeltende globale Regeln

Aus Paket 1 und 2 gelten insbesondere:

- Referenzviewport `390 × 844 px`;
- neutraler, klarer und konsistent gerundeter visueller Stil;
- identischer Header und identische Bottom-Navigation;
- globaler 56-px-Plus-Button im regulären Seitenzustand;
- eingeklappte Suche im Standardzustand;
- lokal gebündelte Outline-Icons;
- Initialen-Avatare statt Profilbilder;
- keine botanischen, handschriftlichen, markenbezogenen oder extern geladenen Grafiken;
- bestehende Business-Logik, Rechte, Server Actions und Offlinefunktionen bleiben erhalten.

## 3. Sheet-System

Paket 3 definiert das wiederverwendbare mobile Sheet-System für spätere Pakete.

### 3.1 Geometrie

- Sheet ist bündig am unteren Viewportrand verankert;
- nur die oberen Ecken sind gerundet, ungefähr 20 px;
- keine frei schwebende Modal-Karte mit Abstand zum unteren Rand;
- iPhone-Safe-Area wird innerhalb des Sheets berücksichtigt;
- Höhe richtet sich nach Inhalt, darf bei langen Formularen bis nahezu Vollbild wachsen;
- Inhalt scrollt innerhalb des Sheets;
- Header und Aktionsfooter dürfen sticky sein.

### 3.2 Hintergrundzustand

Bei geöffnetem Sheet:

- wird die darunterliegende Seite gleichmäßig abgedunkelt;
- ist die Bottom-Navigation sichtbar, aber nicht bedienbar;
- wird der globale Plus-Button ausgeblendet;
- bleiben Hintergrundscroll und Hintergrundinteraktionen gesperrt.

Es darf nie gleichzeitig ein offenes Sheet und ein sichtbarer globaler Plus-Button erscheinen.

### 3.3 Sheet-Header

- klarer Titel;
- genau ein X zum Schließen;
- optional ein Zurück-Pfeil bei mehrstufigen Flows;
- optional ein Overflow-Menü bei bestehenden Objekten;
- kein zweites konkurrierendes Schließen-Element;
- dezenter Drag-Handle kann angezeigt werden.

### 3.4 Sheet-Footer

- primäre Aktion rechts beziehungsweise als breiter Petrol-Button;
- sekundäre Aktion ruhig und visuell nachgeordnet;
- Footer verdeckt keine Felder;
- Buttons bleiben bei Scrollen erreichbar;
- gefährliche Aktionen sind nie primäre Standardaktion.

### 3.5 Navigation innerhalb eines Sheets

Mehrstufige Formulare wechseln den Inhalt desselben Sheets. Es wird kein weiteres Sheet über das aktuelle gelegt.

Erlaubte Muster:

- borderlose Text-Tabs mit Unterstreichung;
- klarer Schrittwechsel mit `Weiter` und `Zurück`;
- Zurück-Pfeil im Header.

Nicht erlaubt:

- Modal über Modal;
- Sheet über Sheet;
- mehrere gleichzeitige Backdrops;
- gleichzeitiger FAB und Sheet;
- unklarer Sprung in ein zweites Formular ohne sichtbaren Kontext.

## 4. Gesamtlogik der Aufgabenflows

Paket 3 besteht aus drei unabhängigen Flows.

### 4.1 Flow A – Aufgabe erstellen

```text
Aufgabenübersicht
→ globaler Plus-Button
→ globales „Neu erstellen“
→ Aufgabe
→ Aufgaben-Sheet
→ Aufgabenart: Einmalig oder Wiederkehrend
```

Der globale Auswahl-Dialog wird später paketübergreifend spezifiziert. Nach Auswahl von `Aufgabe` beginnt der hier definierte Flow.

#### Einmalig

```text
Aufgabe erstellen
→ Details ausfüllen
→ Aufgabe erstellen
→ Sheet schließen
→ Aufgabenübersicht aktualisieren
```

#### Wiederkehrend

```text
Wiederkehrende Aufgabe
→ Schritt 1: Details
→ Schritt 2: Wiederholung
→ Serie speichern
→ Sheet schließen
→ Aufgabenübersicht aktualisieren
```

### 4.2 Flow B – bestehende Aufgabe

```text
Aufgabenübersicht
→ Aufgabe antippen
→ lesende Aufgabendetails
├─ Als erledigt markieren
├─ Bearbeiten
│  → Bearbeitungsmodus im selben Sheet
│  → Speichern
└─ Overflow
   → Löschen oder Archivieren, soweit zulässig
```

Der Detailflow ist unabhängig vom Erstellen-Flow.

### 4.3 Flow C – Suche und Filter

#### Suche

```text
Aufgabenübersicht
→ Lupe
→ Titelbereich wird Suchfeld
→ Ergebnisse
→ X schließt Suche
```

#### Filter

```text
Aufgabenübersicht
→ Filter-Icon
→ Filter-Sheet
→ Filter anwenden
→ Sheet schließen
→ gefilterte Aufgabenübersicht
```

Suche und Filter können kombiniert sein, bleiben aber unterschiedliche Interaktionen.

## 5. Verbindliche vier Referenzscreens

Die vier final zu implementierenden beziehungsweise zu visualisierenden Zustände von Paket 3 sind:

1. Einmalige Aufgabe erstellen;
2. Wiederkehrende Aufgabe – Details;
3. Wiederkehrende Aufgabe – Wiederholung;
4. Bestehende Aufgabe – Detailansicht.

Suche und Filter werden in diesem Dokument vollständig spezifiziert, müssen aber nicht Teil des finalen Vierer-Mockups sein. Ihre visuellen Zustände können später mit den globalen Interaktionszuständen konsolidiert werden.

## 6. Screen 1 – einmalige Aufgabe erstellen

### 6.1 Nutzerfrage

Wie kann ich eine normale Aufgabe möglichst schnell erfassen?

### 6.2 Einstieg

- Nutzer tippt den globalen Plus-Button;
- wählt im globalen Erstellen-Menü `Aufgabe`;
- Aufgaben-Sheet öffnet sich;
- FAB wird ausgeblendet.

### 6.3 Aufgabenart

Am Anfang des Sheets steht eine klare Auswahl:

```text
Einmalig | Wiederkehrend
```

`Einmalig` ist aktiv. Die Auswahl darf als kompaktes Segmented Control umgesetzt werden, da es sich um zwei gleichwertige Modi desselben Erstellen-Vorgangs handelt.

### 6.4 Standardfelder

Sofort sichtbar:

- Titel, erforderlich;
- Fälligkeitsdatum, optional;
- zuständige Person, optional beziehungsweise vorhandener Standard;
- Notiz/Beschreibung, optional.

Beispiel:

```text
Titel *
Was ist zu erledigen?

Fällig am
15.07.2026

Zuständig
J · Jona

Notiz
Optional
```

### 6.5 Weitere Optionen

Ein eingeklappter Bereich `Weitere Optionen` enthält:

- Priorität;
- Sichtbarkeit Familie/Privat;
- gegebenenfalls initialer Status, falls fachlich nötig.

Der Standard-Erstellen-Flow zeigt nicht alle Felder gleichzeitig.

### 6.6 Aktionen

- sekundär: Abbrechen;
- primär: Aufgabe erstellen.

Nach erfolgreicher Erstellung schließt das Sheet. Fehler erscheinen inline und erhalten den Formularzustand.

## 7. Screens 2 und 3 – wiederkehrende Aufgabe

### 7.1 Wechsel der Aufgabenart

Wählt der Nutzer `Wiederkehrend`, bleibt dasselbe Aufgaben-Sheet geöffnet. Der Flow wechselt in einen zweistufigen Modus.

Navigation:

```text
Details ───── Wiederholung
```

Die aktive Stufe verwendet Petrol und eine dünne Unterstreichung. Der Schrittzustand muss zusätzlich über Text verständlich sein.

### 7.2 Screen 2 – Details

#### Nutzerfrage

Was soll regelmäßig erledigt werden und wer ist zuständig?

#### Felder

- Titel, erforderlich;
- zuständige Person;
- Priorität;
- Notiz/Beschreibung;
- Sichtbarkeit;
- optionales Startdatum kann entweder hier oder verbindlich im Wiederholungsschritt liegen; es darf nicht doppelt abgefragt werden.

#### Aktionen

- sekundär: Abbrechen;
- primär: Weiter.

`Weiter` wechselt innerhalb desselben Sheets zu `Wiederholung`. Es öffnet kein neues Sheet.

### 7.3 Screen 3 – Wiederholung

#### Nutzerfrage

Wann und in welchem Abstand soll die Aufgabe entstehen?

#### Verbindliche Felder

- Wiederholungstyp: täglich, wöchentlich, monatlich oder jährlich;
- Intervallanzahl, z. B. alle 1 Woche;
- startbezogene Fälligkeit;
- Startdatum;
- optionales Enddatum;
- Vorlaufzeit: wie viele Tage vorher die konkrete Aufgabe angezeigt/erzeugt wird.

#### Wöchentliche Darstellung

Bei wöchentlicher Wiederholung darf eine kompakte Wochentagsauswahl erscheinen:

```text
M D M D F S S
```

Jeder Tag benötigt ein zugängliches Label, z. B. `Donnerstag`. Die Kurzbuchstaben allein reichen technisch nicht für Accessibility.

#### Monatlich und jährlich

Die UI zeigt nur Regeln, die die bestehende Business-Logik tatsächlich unterstützt. Das Mockup darf keine komplexen Kalenderregeln implizieren, die im Datenmodell nicht vorhanden sind.

Beispiele für zulässige einfache Kommunikation:

- monatlich am Start-/Fälligkeitstag;
- jährlich am gewählten Datum;
- alle X Tage/Monate/Jahre.

Wenn `Woche` intern nicht als native Einheit gespeichert wird, muss die bestehende Normalisierung nachvollziehbar und getestet erfolgen. Das UI darf keinen nicht unterstützten Zustand erzeugen.

#### Vorlaufzeit

Bezeichnung in Alltagssprache:

```text
Aufgabe anzeigen
2 Tage vorher
```

Hilfetext:

> Aufgaben dieser Serie werden automatisch vor dem Fälligkeitsdatum erstellt und erscheinen in der Aufgabenliste.

#### Aktionen

- sekundär: Zurück;
- primär: Serie speichern.

`Zurück` kehrt zu Details zurück, ohne Eingaben zu verlieren.

## 8. Screen 4 – bestehende Aufgabe: Detailansicht

### 8.1 Nutzerfrage

Was ist zu tun, wer ist zuständig und welche direkte Aktion ist sinnvoll?

### 8.2 Einstieg

Nutzer tippt eine Aufgabe in der Aufgabenübersicht. Das Detail-Sheet öffnet lesend. Der FAB wird ausgeblendet.

### 8.3 Inhaltsreihenfolge

1. Status und Fälligkeit;
2. Titel;
3. zuständige Person;
4. Fälligkeitsdatum;
5. Priorität;
6. Sichtbarkeit;
7. Notiz/Beschreibung;
8. Serienbezug, falls vorhanden;
9. Aktivität/Metadaten;
10. Aktionen.

### 8.4 Darstellung

- Status als Text plus Kontrolle;
- nahe oder überschrittene Deadline als dezente Warnung mit Text;
- Initialen-Avatar plus ausgeschriebener Name;
- Metadaten in klaren Zeilen mit lokalen Outline-Icons;
- keine unnötigen Formularfelder im Lesemodus.

### 8.5 Serienbezug

Für erzeugte wiederkehrende Aufgaben erscheint:

```text
Teil der Serie „Mülltonnen rausstellen“
```

Eine Aktion kann die zugrunde liegende Serie öffnen. Dabei muss klar unterschieden werden zwischen:

- nur diese konkrete Aufgabe bearbeiten;
- zukünftige Serie bearbeiten.

Die genaue Änderungslogik muss der bestehenden Fachlogik entsprechen und darf nicht allein im UI entschieden werden.

### 8.6 Primäre Aktionen

- Bearbeiten;
- Als erledigt markieren.

`Als erledigt markieren` ist bei offener Aufgabe primär. Bei erledigter Aufgabe kann eine fachlich vorhandene Wiedereröffnung angeboten werden.

### 8.7 Bearbeiten

`Bearbeiten` wechselt dasselbe Sheet in den Bearbeitungsmodus:

- kein neues Sheet;
- keine neue Backdrop-Ebene;
- bestehende Werte vorausgefüllt;
- Speichern und Abbrechen/Zurück;
- nach Speichern Rückkehr in den Lesemodus oder Schließen gemäß konsistentem App-Muster.

### 8.8 Overflow

Das Overflow-Menü enthält seltene oder gefährliche Aktionen:

- Löschen;
- Archivieren, soweit fachlich vorhanden;
- gegebenenfalls Serie öffnen.

Löschen ist keine ständig sichtbare rote Primäraktion. Vor destruktiven Aktionen ist eine Bestätigung erforderlich.

## 9. Suche

### 9.1 Standardzustand

- nur Lupe im Titelbereich;
- kein dauerhaft sichtbares Suchfeld;
- Filter-Icon bleibt daneben sichtbar.

### 9.2 Geöffneter Zustand

Nach Antippen der Lupe:

- Titel und Hilfetext werden temporär durch ein Suchfeld ersetzt;
- Suchfeld erhält Autofokus;
- Lupe steht im Feld;
- X leert beziehungsweise schließt die Suche;
- Filter bleibt erreichbar;
- Ergebnisse aktualisieren sich gemäß bestehender URL-/Serverlogik.

### 9.3 Suchumfang

Mindestens:

- Titel;
- Beschreibung;
- zuständige Person.

Aktive Suche bleibt beim Öffnen des Filters erhalten.

## 10. Filter

### 10.1 Einstieg

Filter-Icon öffnet ein eigenständiges Aufgaben-Filter-Sheet. Es wird kein zweites Sheet geöffnet, wenn bereits ein Aufgabenformular oder Detail-Sheet aktiv ist.

### 10.2 Filtergruppen

#### Status

- Alle;
- Offen;
- In Arbeit;
- Erledigt.

Archivierte Aufgaben gehören nicht zwingend in den primären Filter und können über einen nachgelagerten Bereich erreichbar bleiben.

#### Fälligkeit

- Heute;
- Überfällig;
- Diese Woche;
- Ohne Datum.

#### Zuständig

- Familienmitglieder mit Initialen und Namen;
- Mehrfachauswahl nur, wenn die bestehende Filterlogik dies unterstützt.

#### Priorität

- Niedrig;
- Mittel;
- Hoch;
- Dringend.

#### Sichtbarkeit

- Familie;
- Privat.

### 10.3 Aktive Suche im Filter

Ist eine Suche aktiv, zeigt das Filter-Sheet einen nicht konkurrierenden Kontext:

```text
Aktive Suche: „Vertrag“
```

Dies ist kein zweites Suchfeld. Suche und Filter bleiben getrennte Werkzeuge.

### 10.4 Footer

- sekundär: Zurücksetzen;
- primär: `X Ergebnisse anzeigen`.

Die Trefferzahl darf nur angezeigt werden, wenn sie zuverlässig berechnet werden kann. Andernfalls lautet die Aktion `Filter anwenden`.

## 11. Aufgabenstatus

Primäre UI-Statuswerte:

- Offen;
- In Arbeit;
- Erledigt.

Archivieren ist eine kontextuelle Verwaltungsaktion und kein gleichwertiger täglicher Statusbutton.

Status muss per Text erkennbar sein. Farbe oder Icon allein reicht nicht.

## 12. Offline- und Speicherverhalten

Bestehende Offlinefunktionen für:

- neue Aufgaben;
- Statusänderungen

müssen erhalten bleiben.

Bei Offline-Erstellung:

- bestätigt die UI lokal gespeicherte/ausstehende Änderung klar;
- schließt der Flow nicht mit einer falschen Server-Erfolgsbehauptung;
- wird der Synchronisierungsstatus über das bestehende globale System kommuniziert.

Wiederkehrende Aufgaben und komplexe Bearbeitungen dürfen nur offline angeboten werden, wenn die bestehende Synchronisierungslogik sie unterstützt.

## 13. Validierung und Fehler

- erforderliche Felder sind visuell markiert;
- Fehler stehen direkt am betreffenden Feld;
- Eingaben bleiben nach Fehler erhalten;
- primäre Aktion zeigt einen Pending-Zustand;
- Doppelsubmits werden verhindert;
- Sheet schließt nur nach erfolgreicher lokaler beziehungsweise serverseitiger Annahme;
- Fokus springt bei Fehlern sinnvoll zum ersten betroffenen Feld.

## 14. Accessibility

- Touchziele ungefähr 44 px;
- sichtbare `focus-visible`-Zustände;
- Sheet erhält Dialogsemantik und Fokusfalle;
- Escape schließt auf unterstützten Plattformen;
- Fokus kehrt nach Schließen zum Auslöser zurück;
- Initialen-Avatare besitzen zugängliche Namen;
- Wochentage haben vollständige zugängliche Labels;
- Warnungen und Status verwenden Text zusätzlich zu Farbe;
- reduzierte Bewegung wird respektiert.

## 15. Explizite Nicht-Ziele von Paket 3

- kein globales „Neu erstellen“-Menü im Detail;
- keine Finanz-, Auto-, Vertrags- oder Dokumentformulare;
- keine komplexen frei definierbaren Kalenderregeln;
- keine Umgestaltung der Aufgaben-Business-Logik;
- keine neuen Offlinefähigkeiten ohne Sync-Unterstützung;
- keine Desktop-Dialoge;
- kein endgültiges globales Toast-System;
- keine gestapelten Sheets.

## 16. Implementierungsregeln für Codex

1. Paket 1, Paket 2 und danach Paket 3 vollständig lesen.
2. Einen gemeinsamen Sheet-/Dialog-Primitive verwenden.
3. Sheet, Backdrop, Scroll-Lock, Fokusfalle und Footer nicht pro Seite duplizieren.
4. Globalen FAB bei jedem geöffneten Sheet ausblenden.
5. Wiederkehrende Erstellung innerhalb eines Sheets und eines zusammenhängenden Formularzustands implementieren.
6. Eingaben beim Schrittwechsel erhalten.
7. Detail- und Bearbeitungsmodus im selben Sheet abbilden.
8. Suche ersetzt nur temporär den Titelbereich und öffnet kein Sheet.
9. Filter öffnet ein eigenständiges Sheet und dupliziert die Suche nicht.
10. Bestehende Feldnamen, Server Actions, Rechte und Offline-Hooks erhalten.
11. Keine im Datenmodell nicht unterstützten Wiederholungsregeln hinzufügen.
12. Auf 390 × 844 px Formularscroll, Tastatur, Footer und Safe-Area prüfen.
13. Keine neue CSS-Override-Schicht ohne geordnete Komponentenstruktur anhängen.

## 17. Akzeptanzkriterien

Paket 3 ist implementierungsseitig erfüllt, wenn:

- alle Aufgaben-Overlays denselben Sheet-Primitive verwenden;
- kein Sheet als frei schwebende Karte über dem unteren Rand erscheint;
- bei offenem Sheet FAB und Hintergrundinteraktionen deaktiviert sind;
- nie zwei Sheets übereinander geöffnet werden;
- einmalige und wiederkehrende Aufgaben im selben Erstellen-Flow starten;
- wiederkehrende Aufgaben einen klaren Details- und Wiederholungsschritt besitzen;
- `Weiter` und `Zurück` keine Eingaben verlieren;
- eine bestehende Aufgabe zunächst lesend geöffnet wird;
- Bearbeiten im selben Sheet statt in einem neuen Overlay erfolgt;
- Suche standardmäßig eingeklappt ist und den Titelbereich temporär ersetzt;
- Filter als separates Sheet umgesetzt ist;
- aktive Suche im Filter nur als Kontext erscheint;
- Status, Fälligkeit, Person, Priorität und Sichtbarkeit filterbar bleiben;
- Initialen statt Profilbilder verwendet werden;
- keine destruktive Aktion als Primärbutton erscheint;
- bestehende Offline-, Rechte- und Aufgabenlogik erhalten bleibt;
- Tastatur, Footer und Safe-Area keine Felder verdecken;
- kein horizontaler Overflow bei 390 px entsteht.

## 18. Offene Punkte für spätere Pakete

- globales Erstellen-Menü und Übergang zu allen Inhaltstypen;
- konkrete Desktop-Darstellung von Sheets als Dialoge;
- konsolidierte Such- und Filterzustände aller Module;
- globale Feedback-/Toast-Logik;
- Konfliktbehandlung bei Offline-Synchronisierung;
- genaue Bearbeitung einer einzelnen Serieninstanz gegenüber zukünftigen Instanzen.

