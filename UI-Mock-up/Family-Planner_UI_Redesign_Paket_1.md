# Family Planner – UI-Redesign Paket 1

Status: abgestimmte Designgrundlage für die spätere Implementierung  
Basis: Funktionsumfang von `main`; spätere Funktionen aus Entwicklungsbranches werden nicht stillschweigend vorausgesetzt.  
Geltungsbereich: Mobile Cockpit, Aufgaben, Finanzen–Übersicht und Finanzen–Analyse.

## 1. Einordnung in den Gesamtprozess

Das Redesign wird in neun Paketen entwickelt. Dieses Dokument beschreibt ausschließlich Paket 1. Globale Entscheidungen aus diesem Paket gelten für spätere Pakete weiter, bis sie ausdrücklich ersetzt werden.

Die schriftliche Spezifikation definiert Funktion und Verhalten. Das finale Mockup definiert visuelle Hierarchie, Proportionen und Atmosphäre. Bei Widersprüchen hat die schriftliche Spezifikation Vorrang; offensichtliche Bildgeneratorfehler dürfen nicht implementiert werden.

## 2. Produkt- und Designziel

Die App soll wie ein klarer, leichter und persönlicher Alltagshelfer wirken:

- erwachsen und hochwertig, aber nicht wie eine professionelle Banking-App;
- klar und geometrisch, aber durch konsistente Rundungen nicht steril;
- ruhig und aufgeräumt, ohne „Öko“- oder Papierwaren-Ästhetik;
- funktional dicht genug für den Alltag, ohne alle Funktionen gleichzeitig zu zeigen.

### Nicht gewünschte Stilrichtungen

- keine dunklen Banking-Hero-Cards oder Börsencharts;
- keine Pflanzen, Blätter, Sonnen, organischen Doodles oder handgezeichneten Linien;
- keine Handschrift- oder handschriftähnliche Typografie;
- kein cremefarbenes, gelbstichiges oder papierartiges Off-White;
- keine sterile Krankenhaus-, Behörden- oder Enterprise-Dashboard-Optik;
- keine verspielte Kinder- oder Familien-Clipart;
- kein Pastell-Regenbogen und keine Farbe ohne semantischen Zweck;
- kein Glassmorphism und keine starken, dekorativen Schatten.

## 3. Verbindliche visuelle Annahmen

### 3.1 Grundflächen

- App-Hintergrund: neutrales, sehr helles Grau, ungefähr `#F6F7F8`.
- Primäre Flächen: Weiß.
- Alternative Flächen: sehr dezente kühle Tönungen.
- Primärtext: dunkles neutrales Anthrazit.
- Sekundärtext: kühles Schiefergrau.
- Rahmen: sehr helles neutrales Grau.

### 3.2 Marken- und Statusfarben

- Primärfarbe: klares, leicht kühles Petrol.
- Positiv: kontrolliertes Grün.
- Negativ: klares, nicht zu aggressives Korallrot.
- Warnung: gedämpftes Amber/Orange.
- Informativ: weiches Blau.
- Kategorieakzente dürfen zusätzlich dezentes Violett oder weitere kontrollierte Farben verwenden.

Farben dürfen Informationen unterstützen, aber nie die einzige Informationsträgerin sein.

### 3.3 Formen

- Kartenradius: konsistent etwa 14–16 px.
- Controls und Eingabefelder: etwa 12–14 px.
- Kleine Statuschips dürfen vollständig gerundet sein.
- Karten bleiben klare geometrische Rechtecke; keine unregelmäßigen organischen Flächen.
- Freundlichkeit entsteht durch Rundungen, Abstände, Ikonografie und sanfte Tönungen.

### 3.4 Grafische Highlights

Grafische Highlights sind erlaubt, aber nur selektiv:

- präzise Bögen oder Teilkreise;
- kleine Punktraster;
- einfache Liniensegmente;
- dezente geometrische Farbflächen;
- kleine, inhaltlich sinnvolle Mikrodiagramme.

Pro sichtbarem Viewport höchstens ein bis zwei solcher Highlights. Sie dürfen Text und Daten nie beeinträchtigen.

### 3.5 Typografie und Zahlen

- ausschließlich eine moderne, gut lesbare Sans-Serif-Schrift;
- keine Handschrift- oder Display-Schrift;
- klare Abstufung zwischen Seitentitel, Abschnitt, Inhalt und Metadaten;
- Geldbeträge, Daten und Kennzahlen möglichst mit tabellarischen Ziffern;
- keine unnötige Versalschreibung.

## 4. Verbindlicher Mobile-App-Shell

Referenzviewport für Design und visuelle Tests: `390 × 844 px`.

Alle Screens verwenden:

- identische Status- und Safe-Areas;
- identische Headerhöhe;
- identische horizontale Seitenabstände;
- identische Bottom-Navigation;
- identische Position des globalen Plus-Buttons;
- ausreichend unteren Inhaltsabstand, damit Navigation und Plus-Button nichts verdecken.

### 4.1 Header

- links: kleines App-Zeichen, „Familien-App“, darunter `Familie · Nutzer`;
- rechts: Einstellungen als Icon-Button;
- kein Abmelde-Icon im mobilen Header;
- kompakt und auf allen vier Seiten identisch.

### 4.2 Bottom-Navigation

Genau sechs Ziele:

1. Cockpit
2. Aufgaben
3. Finanzen
4. Auto
5. Verträge
6. Dokumente

Aktiver Zustand: Petrol, kombiniert mit einem kleinen Unterstrich oder einer sehr dezenten Hintergrundtönung. Keine große aktive Kachel.

### 4.3 Globaler Plus-Button

Der Plus-Button ist ein plattformübergreifendes Identitätselement:

- immer 56 × 56 px;
- immer kreisrund;
- immer Petrol mit weißem Plus;
- keine weiteren Icons im Button;
- immer 16 px vom rechten Rand;
- immer 16 px oberhalb der Bottom-Navigation;
- Position und Größe sind unabhängig vom Seiteninhalt;
- darf keine wichtigen Inhalte oder Aktionen verdecken.

Der Erstellen-Dialog ist nicht Bestandteil von Paket 1. Wenn er später geöffnet ist, wird der Plus-Button ausgeblendet; der Dialog besitzt ein eigenes Schließen-Element.

## 5. Suche und Filter

Suche ist auf Aufgaben und Finanzen vorhanden, im Standardzustand aber eingeklappt.

### Standardzustand

- im Seitentitelbereich stehen ein Lupen-Icon und ein Filter-Icon;
- Aufgaben und beide Finanzansichten verwenden exakt dieselben Icongrößen, Touchflächen und Abstände;
- Cockpit benötigt keine globale Suche.

### Geöffnete Suche

Nach Antippen der Lupe:

- ersetzt ein breites Suchfeld vorübergehend den Titelbereich;
- erhält das Feld Autofokus;
- erscheint ein eindeutiges X zum Schließen;
- bleibt die darunterliegende Seite strukturell stabil;
- wird die Suche per Enter oder vorhandener serverseitiger Suchlogik ausgeführt.

Die geöffnete Suche ist ein eigener Interaktionszustand und wird nicht permanent auf Übersichtsseiten angezeigt.

## 6. Personen und Avatare

Paket 1 verwendet keine Profilfotos.

- Personen werden durch Initialen-Avatare dargestellt, z. B. `J`, `L`, `B`;
- jede Person erhält eine stabile, dezente Farbe aus einer kleinen Palette;
- der Name bleibt immer zusätzlich als Text sichtbar;
- Avatarfarben sind Wiedererkennungshilfe, keine alleinige Information;
- Listengröße ungefähr 24–28 px.

## 7. Kategorie-Icons

Kategorien verwenden lokal gebündelte Icons aus einer konsistenten Outline-Iconfamilie. Es werden keine Icons aus dem Internet nachgeladen.

### Technische Annahme

- in der Datenbank wird nur ein stabiler Schlüssel gespeichert, z. B. `car`, `plane`, `utensils`, `shopping-basket`, `receipt`;
- die Anwendung ordnet den Schlüssel einer lokal importierten Icon-Komponente zu;
- unbekannte oder entfernte Schlüssel fallen auf `tag` zurück;
- Icon, Farbe und Kategoriename werden immer gemeinsam dargestellt.

### Nutzerwahl

Eine spätere Setup-Oberfläche bietet eine kuratierte, durchsuchbare Auswahl von etwa 40–60 lokal verfügbaren Icons. Die Auswahloberfläche gehört nicht zu Paket 1. Paket 1 zeigt nur die resultierenden Kategorie-Icons.

## 8. Finanz-Informationsarchitektur

Finanzen trennt drei unabhängige Ebenen konsequent:

1. Bereich: Übersicht oder Analyse;
2. Zeitraum: Monat oder Jahr plus konkreter Zeitraum;
3. Datenmenge: Suche und Filter.

### 8.1 Übersicht / Analyse

Direkt unter dem Seitentitel steht eine randlose Textnavigation:

```text
Übersicht      Analyse
```

- kein umschließendes Segmented-Control-Kästchen;
- kein Pill-Hintergrund;
- aktiver Eintrag in Petrol mit dünner 2-px-Unterstreichung;
- Position in beiden Ansichten identisch;
- der gewählte Zeitraum bleibt beim Wechsel erhalten.

### 8.2 Zeitraum

Unter der Bereichsnavigation:

- Pfeile zum vorherigen/nächsten Zeitraum;
- zentraler Zeitraum, z. B. `Juli 2026` oder `2026`;
- daneben ein kleiner Schalter `Monat | Jahr`;
- diese Steuerung ist visuell und semantisch von Übersicht/Analyse getrennt.

### 8.3 Analyse-Unterbereiche

In Analyse folgt eine kompakte, horizontal nutzbare Textnavigation:

- Kategorien
- Budgets
- Labels
- Vergleich

Auch hier kennzeichnet eine dünne Unterstreichung den aktiven Bereich. Keine große Buttonmatrix.

## 9. Screen 1 – Cockpit

### Nutzerfrage

Was ist heute beziehungsweise als Nächstes wichtig, und wie sieht mein Monat grob aus?

### Inhaltsreihenfolge

1. Begrüßung und kurzer Hilfetext;
2. kompakter 2×2-Statusbereich;
3. „Als Nächstes“;
4. „Letzte Aktivitäten“ beziehungsweise kompakte Fristinformation;
5. globale Navigation und Plus-Button.

### Statusbereich

- Einnahmen: 298,99 €;
- Ausgaben: 814,60 €;
- Saldo: −515,61 €;
- offene Aufgaben: 2.

Die vier Felder dürfen unterschiedlich dezent getönt sein. Sie sind kompakt und nicht als dunkle Banking-Hero-Cards gestaltet. Kleine geometrische Mikrodiagramme sind erlaubt.

### Listen

- kompakte Zeilen statt großer Karten;
- Titel, relevante Person, Datum/Status und Betrag;
- Initialen-Avatare nur bei Personenbezug;
- klare Links „Alle anzeigen“ für vollständige Bereiche.

## 10. Screen 2 – Aufgaben

### Nutzerfrage

Welche Aufgaben sind als Nächstes relevant, und was ist geplant?

### Inhaltsreihenfolge

1. Titel mit eingeklappter Suche und Filter;
2. kurze Statusfilter;
3. kompakte Statuszusammenfassung;
4. priorisierte Aufgaben;
5. geplante Aufgaben;
6. Plus-Button und Navigation.

### Statusfilter

- Alle
- Offen
- Heute
- Überfällig
- Geplant

Keine vier großen KPI-Karten. Filter bleiben kompakt.

### Aufgabenzeile

- Checkbox beziehungsweise Statuskontrolle;
- Titel;
- Initialen-Avatar plus Name;
- Fälligkeitsdatum;
- kurze Prioritäts-/Statusinformation;
- bald fällige Aufgabe mit sehr dezenter Korall-/Amber-Tönung;
- Farbe nie ohne Textstatus verwenden.

## 11. Screen 3 – Finanzen: Übersicht

### Nutzerfrage

Wie stehe ich im ausgewählten Zeitraum finanziell da, und was wurde zuletzt gebucht?

### Inhaltsreihenfolge

1. Titel mit Lupe und Filter;
2. randlose Navigation Übersicht/Analyse, Übersicht aktiv;
3. Zeitraumsteuerung, hier `Juli 2026`, Monat aktiv;
4. kompakte Finanzzusammenfassung;
5. Vorschau „Ausgaben nach Kategorie“;
6. letzte Buchungen;
7. Inline-Link „Detaillierte Analyse ansehen →“;
8. Plus-Button und Navigation.

### Finanzzusammenfassung

- Einnahmen: 298,99 €;
- Ausgaben: 814,60 €;
- Saldo: −515,61 €;
- Budget übrig: 585,40 €.

Helle Fläche, dunkler Text, höchstens ein dezentes geometrisches Punktraster oder Bogenmotiv. Keine dunkle Hero-Card.

### Analysevorschau

Eine kleine Visualisierung darf die wichtigsten Kategorien zeigen. Sie ist Vorschau, nicht die vollständige Analyse. Der Link zur Analyse muss klar erkennbar sein, aber nicht wie ein dominanter Primärbutton wirken.

## 12. Screen 4 – Finanzen: Analyse

### Nutzerfrage

Wofür wurde im gewählten Zeitraum Geld ausgegeben, und welche Entwicklung ist relevant?

### Inhaltsreihenfolge

1. Titel mit Lupe und Filter;
2. Übersicht/Analyse, Analyse aktiv;
3. Zeitraumsteuerung, hier `2026`, Jahr aktiv;
4. Analyse-Unterbereiche, Kategorien aktiv;
5. Kategorienauswertung;
6. kurzer hilfreicher Insight;
7. Plus-Button und Navigation.

### Kategorienauswertung

Darstellung als mobile, gut lesbare horizontale Balkenliste:

- Auto
- Segelfliegen
- Restaurant
- Nahrung
- Gebühren

Jede Zeile enthält:

- lokal gebündeltes Kategorie-Icon;
- Kategoriename;
- Balken;
- Betrag;
- Anteil;
- kleine Veränderungsangabe mit Richtung und Text/Farbe.

Kein dominierendes Kreisdiagramm. Der Insight erklärt die Daten in natürlicher, kurzer Sprache, etwa: „Auto ist aktuell deine größte Kategorie.“

## 13. Interaktions- und Zustandsannahmen

- aktive Tabs und Filter sind per Text und visuellem Zustand erkennbar;
- Touchziele für Icons und Controls ungefähr 44 px;
- Fokuszustände sind sichtbar;
- Animationen kurz und funktional;
- `prefers-reduced-motion` wird respektiert;
- Lade-, Fehler-, Leer- und Offlinezustände werden in einem späteren Paket systematisch spezifiziert;
- bestehende URL-Parameter, Server Actions, Sichtbarkeitsregeln und Offline-Funktionen dürfen durch das visuelle Refactoring nicht verändert werden.

## 14. Explizite Nicht-Ziele von Paket 1

Nicht Bestandteil dieses Pakets:

- Erstellen-Dialog und Eingabeformulare;
- geöffneter Suchzustand;
- Filter-Bottom-Sheets;
- Kategorie-Icon-Picker;
- Budgets-, Labels- und Vergleichsdetails;
- Desktop-Mockups;
- freie Widget-Anordnung;
- Profilbilder;
- neue Business-Logik oder neue Kennzahlen.

## 15. Implementierungsregeln für Codex

1. Vor UI-Änderungen dieses Dokument vollständig lesen.
2. `main` als funktionale Ausgangsbasis verwenden.
3. Business-Logik, Rechte, Routen, Server Actions und Formularfeldnamen nicht ohne ausdrücklichen Auftrag ändern.
4. App-Shell und wiederverwendbare Primitives zuerst implementieren.
5. Keine seitenlokalen Varianten von Header, FAB, Suche oder Finanznavigation erfinden.
6. Bestehende Funktionen nicht entfernen, sondern bei Bedarf über Progressive Disclosure erreichbar halten.
7. Nach jedem Screen auf `390 × 844 px` prüfen.
8. Visuelle Screenshots mit dem finalen Mockup vergleichen.
9. Offensichtliche Text- oder Zahlenfehler des Mockups nicht übernehmen.
10. Keine weiteren Schichten am Ende einer historisch gewachsenen CSS-Datei anhängen, ohne vorher eine geordnete CSS-/Komponentenstruktur festzulegen.

## 16. Akzeptanzkriterien

Paket 1 ist implementierungsseitig erfüllt, wenn:

- alle vier Seiten denselben mobilen App-Shell verwenden;
- Header, Navigation und FAB pixelkonsistent positioniert sind;
- der FAB auf allen Seiten 56 px groß ist und nur ein Plus enthält;
- Aufgaben und beide Finanzansichten standardmäßig nur Lupen-/Filter-Icons zeigen;
- kein dauerhaft sichtbares Suchfeld vorhanden ist;
- Übersicht/Analyse als randlose Textnavigation mit Unterstrich umgesetzt ist;
- Monat/Jahr eindeutig davon getrennt ist;
- der Zeitraum beim Wechsel zwischen Übersicht und Analyse erhalten bleibt;
- Kategorien lokal gebündelte Icons mit Text und Farbe verwenden;
- Personen Initialen statt Fotos verwenden;
- keine botanischen, handschriftlichen oder cremefarbenen „Öko“-Motive vorkommen;
- die Oberfläche klar, geometrisch, konsistent gerundet und dennoch nicht steril wirkt;
- vorhandene Funktionen, Berechtigungen und Datenlogik unverändert funktionieren;
- kein horizontaler Seitenoverflow bei 390 px entsteht;
- Navigation und FAB keine Inhalte verdecken.

## 17. Offene Punkte für spätere Pakete

- genaue Erstellen- und Bearbeitungsflows;
- finale kuratierte Kategorie-Icon-Liste und Suchsynonyme;
- Filter- und Sortier-Sheets;
- geöffnete Suchansicht;
- detaillierte Budgets-, Labels- und Vergleichsansichten;
- Desktop-Übertragung und Widget-Raster;
- Feedback-, Offline-, Lade- und Fehlerzustände.

