# Family Planner – UI-Redesign Paket 2

Status: abgestimmte Designgrundlage für die spätere Implementierung  
Abhängigkeit: `Family-Planner_UI_Redesign_Paket_1.md` ist vollständig verbindlich.  
Geltungsbereich: Mobile Auto, Verträge, Dokumente und Einstellungen.

## 1. Einordnung

Das UI-Redesign wird in neun Paketen entwickelt. Paket 2 ergänzt die vier in Paket 1 definierten Kernansichten um die verbleibenden Hauptbereiche der App.

Alle globalen Entscheidungen aus Paket 1 gelten weiter, insbesondere:

- neutraler, klarer und konsistent gerundeter visueller Stil;
- Mobile-Referenzviewport `390 × 844 px`;
- identischer App-Header und identische Bottom-Navigation;
- eingeklappte Suche im Standardzustand;
- globaler Plus-Button mit fester Geometrie und Position;
- lokal gebündelte Outline-Icons;
- keine Profilfotos, Markenlogos oder extern geladenen Grafiken;
- keine botanischen, handschriftlichen oder cremefarbenen Gestaltungselemente.

Die schriftliche Spezifikation definiert Funktion und Verhalten. Das finale Mockup definiert visuelle Hierarchie, Proportionen und Atmosphäre. Bei Konflikten hat die schriftliche Spezifikation Vorrang. Offensichtliche Text-, Icon- oder Datenfehler eines generierten Mockups dürfen nicht implementiert werden.

## 2. Ziel von Paket 2

Paket 2 überträgt das Designsystem auf vier sehr unterschiedliche Nutzungskontexte:

1. Fahrzeugdaten und Tankstopps;
2. laufende Verträge, Kosten und Kündigungsfristen;
3. externe Links und lokale NAS-Dokumente;
4. persönliche und administrative Einstellungen.

Die Seiten sollen funktional direkt bleiben, aber auf Mobile nur die wichtigsten Informationen sofort zeigen. Detailbearbeitung, Setup und komplexe Eingaben werden über nachgelagerte Ansichten oder spätere Pakete erschlossen.

## 3. Gemeinsamer App-Shell

### 3.1 Header

Alle vier Screens verwenden dieselbe Headergeometrie wie Paket 1:

- App-Zeichen;
- „Familien-App“;
- Kontext `Familie · Nutzer`;
- Einstellungen-Icon rechts;
- kein mobiles Abmelde-Icon.

Auf der Einstellungsseite darf das Einstellungen-Icon als aktiv erscheinen, bleibt aber exakt an derselben Stelle und in derselben Größe.

### 3.2 Bottom-Navigation

Die Bottom-Navigation zeigt weiterhin genau:

1. Cockpit
2. Aufgaben
3. Finanzen
4. Auto
5. Verträge
6. Dokumente

Auto, Verträge und Dokumente markieren jeweils ihren aktiven Tab mit Petrol und dünner Unterstreichung. Einstellungen ist kein siebter Bottom-Navigationseintrag; dort bleibt kein Haupttab aktiv.

### 3.3 Globaler Plus-Button

Auf Auto, Verträge und Dokumente gilt unverändert:

- 56 × 56 px;
- kreisrund;
- Petrol;
- ausschließlich weißes Plus;
- 16 px vom rechten Rand;
- 16 px oberhalb der Bottom-Navigation;
- feste Position unabhängig vom Seiteninhalt.

Auf Einstellungen wird kein Plus-Button angezeigt. Einstellungen ist kein allgemeiner Erstellungskontext. Neue Mitglieder, Dokumentenablagen oder andere administrative Objekte werden innerhalb der jeweiligen Einstellungsunterseite angelegt.

## 4. Suche und Filter

Auto, Verträge und Dokumente verwenden im Standardzustand nur:

- Lupen-Icon;
- Filter-Icon.

Beide stehen im Seitentitelbereich und verwenden dieselben Touchflächen, Größen und Abstände wie Aufgaben und Finanzen aus Paket 1.

Nach Antippen der Lupe ersetzt ein fokussiertes Suchfeld temporär den Titelbereich. Ein X schließt die Suche. Dauerhaft sichtbare große Suchfelder sind nicht vorgesehen.

Einstellungen besitzt weder Suche noch Filter, solange die Anzahl der Einstellungsgruppen überschaubar bleibt.

## 5. Lokales Icon-System

Alle Icons stammen aus derselben lokal gebündelten Outline-Iconfamilie. Die App lädt keine Icons, Logos oder Markenassets aus dem Internet.

### 5.1 Verbindliche Regeln

- gespeichert wird ein stabiler Icon-Schlüssel, nicht SVG-Markup und kein externer Pfad;
- jeder Schlüssel wird einer lokal importierten Komponente zugeordnet;
- unbekannte Schlüssel erhalten einen neutralen Fallback;
- Icons werden immer mit Text kombiniert;
- Farbtönungen dienen nur der Orientierung;
- keine echten Anbieter- oder Markenlogos.

### 5.2 Vertragsicons

Verträge verwenden generische Symbole nach Vertragsart:

| Vertragsart | Beispielschlüssel | Symbol |
|---|---|---|
| Handy/Mobilfunk | `smartphone` | Smartphone |
| Streaming | `play-square` | Play-Symbol in Rechteck |
| Fahrzeugversicherung | `shield-car` | Schild beziehungsweise Fahrzeug mit Schild |
| Internet | `wifi` | WLAN |
| Energie | `zap` | Blitz |
| Wohnen/Miete | `home` | Haus |
| Versicherung allgemein | `shield` | Schild |
| Mitgliedschaft | `users` | Personen |
| Sonstiges | `file-text` | Dokument |

Anbieternamen wie Congstar oder Netflix bleiben Text. Ihre Markenlogos werden nicht verwendet.

### 5.3 Dokumenticons

Dokumente verwenden lokale Icons nach Typ oder Quelle:

- PDF: Dokument/PDF, Korallton;
- Tabellen: Spreadsheet, Grün;
- Link: Kettenglied, Blau;
- lokaler Ordner: Ordner, Petrol oder neutral;
- unbekannte Datei: neutrales Dokument;
- nicht verfügbar: neutrales Warn-/Offline-Symbol zusätzlich zum Textstatus.

## 6. Screen 1 – Auto

### 6.1 Nutzerfrage

Wie sieht der Verbrauch des ausgewählten Autos im gewählten Zeitraum aus, und welche Tankstopps wurden erfasst?

### 6.2 Inhaltsreihenfolge

1. Seitentitel mit eingeklappter Suche und Filter;
2. Fahrzeugauswahl;
3. Zeitraumsteuerung;
4. kompakte Fahrzeugkennzahlen;
5. Bereichsnavigation;
6. letzte Tankstopps;
7. Link zur vollständigen Liste;
8. globaler Plus-Button und Navigation.

### 6.3 Fahrzeugauswahl

- kompakte Auswahlzeile direkt unter dem Titel;
- zeigt den Namen, z. B. `Seat Leon weiss`;
- Chevron signalisiert Wechselmöglichkeit;
- kein großes Fahrzeug-Hero und kein Foto erforderlich;
- archivierte Fahrzeuge erscheinen nicht in der regulären Auswahl.

### 6.4 Zeitraumsteuerung

Analog zu Finanzen:

- vorheriger/nächster Zeitraum über Pfeile;
- zentral `Mai 2026` beziehungsweise das gewählte Jahr;
- kleiner Schalter `Monat | Jahr`;
- ausgewählter Zustand in Petrol;
- Suche und Filter bleiben davon unabhängig.

### 6.5 Kennzahlen

Ein gemeinsames, helles Übersichtspanel zeigt:

- Tankkosten: 67,36 €;
- Liter: 35,10 l;
- gefahren: 565 km;
- Durchschnittsverbrauch: 6,21 l/100 km.

Das Panel darf eine sehr dezente geometrische Routenlinie oder einen präzisen Bogen enthalten. Keine Fahrzeugillustration und kein dunkler Hero-Hintergrund.

### 6.6 Bereichsnavigation

Randlose Textnavigation mit dünner Unterstreichung:

- Tankstopps
- Analyse
- Jahresvergleich

`Tankstopps` ist im Paket-2-Mockup aktiv. Die anderen Ansichten werden in Paket 6 weiter spezifiziert.

### 6.7 Tankstoppzeile

Jede kompakte Zeile zeigt mindestens:

- Datum;
- Kilometerstand;
- Betrag;
- Liter;
- abgeleiteten Verbrauch;
- Chevron für Details.

Der Link `Alle Tankstopps anzeigen →` führt zur vollständigen Liste. Das Plus öffnet den globalen Erstellen-Flow mit Tankstopp als möglicher Auswahl.

## 7. Screen 2 – Verträge

### 7.1 Nutzerfrage

Welche laufenden Verträge verursachen Kosten, und welche Kündigungsfrist verlangt Aufmerksamkeit?

### 7.2 Inhaltsreihenfolge

1. Titel mit eingeklappter Suche und Filter;
2. kurzer Hilfetext;
3. primäre Statusnavigation;
4. kompakte Zusammenfassung;
5. Vertragsübersicht;
6. Plus-Button und Navigation.

### 7.3 Primäre Statusnavigation

Sichtbar sind ausschließlich:

- Aktiv
- Beendet

Die Navigation ist randlos und verwendet eine dünne Petrol-Unterstreichung.

### 7.4 Vertragsentwürfe

Der technische Status `DRAFT` bleibt bestehen, erhält aber keine eigene prominente Seite und keinen dauerhaften Haupttab.

- Entwürfe sind über den Filter erreichbar;
- ein aktiver Filter wird sichtbar gekennzeichnet;
- keine Business-Logik oder bestehenden Entwurfsdaten werden entfernt;
- die Entscheidung betrifft nur die primäre mobile Navigation.

### 7.5 Zusammenfassung

Ein gemeinsames, kompaktes Panel zeigt:

- aktive Kosten: 243,26 € pro Monat;
- Anzahl Verträge: 5;
- nächste Kündigung: 15.06.

Der Monatswert muss technisch aus den unterschiedlichen Zahlungsintervallen korrekt normalisiert werden; das UI darf keine neue Berechnungslogik erfinden.

### 7.6 Vertragszeile

Jede kompakte, aufklappbare Zeile enthält:

- generisches lokales Vertragsart-Icon;
- Anbietername;
- Vertragsart;
- Preis;
- Zahlungsrhythmus;
- Status;
- nächste Zahlung oder relevante Frist;
- Chevron.

Eine nahe Kündigungsfrist erhält eine sehr dezente Amber-/Koralltönung sowie einen Textstatus. Kein reines Farbsignal.

### 7.7 Suche und Filter

Suche umfasst mindestens:

- Anbieter;
- Vertragsart;
- Notiz;
- Status.

Filter enthält unter anderem Entwürfe, Sichtbarkeit und weitere bestehende Statuswerte. Der Filter ist ein später genauer zu spezifizierender Interaktionszustand.

## 8. Screen 3 – Dokumente

### 8.1 Nutzerfrage

Wie finde und öffne ich gespeicherte Dokumentverweise und Dateien aus der lokalen NAS-Ablage?

### 8.2 Funktionsbasis

Die Dokumentansicht berücksichtigt:

- externe HTTPS-Verweise;
- Synology-HTTPS-Links;
- WebDAV-HTTPS-Links;
- lokale Dateien aus einem gemounteten NAS-Ordner;
- Verknüpfungen zu Verträgen, Aufgaben, Ausgaben oder allgemeinen Kontexten.

Die lokale NAS-Funktion stammt aktuell aus einem Entwicklungsbranch und muss vor Implementierung sauber mit dem Zielbranch integriert werden. Sicherheitsprüfungen dürfen nicht durch das UI-Redesign verändert werden.

### 8.3 Inhaltsreihenfolge

1. Titel mit eingeklappter Suche und Filter;
2. kurzer Hilfetext;
3. Hauptnavigation Gespeichert/NAS-Dateien;
4. Quellenfilter;
5. zuletzt verwendete beziehungsweise gespeicherte Dokumente;
6. Plus-Button und Navigation.

### 8.4 Hauptnavigation

Randlose Textnavigation:

- Gespeichert
- NAS-Dateien

`Gespeichert` zeigt referenzierte Dokumente unabhängig von ihrer Quelle. `NAS-Dateien` öffnet den Explorer der freigegebenen lokalen Dokumentenablagen. Der Explorer selbst wird in Paket 8 spezifiziert.

### 8.5 Quellenfilter

Kompakte Optionen:

- Alle
- Lokale Dateien
- Links

Diese filtern die gespeicherten Verweise. Sie ersetzen nicht die Hauptnavigation.

### 8.6 Dokumentzeile

Jede Zeile enthält:

- lokales Datei-/Link-Icon;
- Titel;
- Dateityp;
- Quelle, z. B. `NAS-Datei`, `Synology-Link` oder `Vertrag`;
- optional Größe und letztes Änderungs-/Öffnungsdatum;
- Overflow-Menü.

Mögliche Overflow-Aktionen werden nur angezeigt, wenn funktional und rechtlich erlaubt:

- Vorschau;
- Download;
- Link öffnen;
- Bearbeiten;
- Löschen.

### 8.7 Nicht verfügbare Datei

Ist eine lokale Datei nicht erreichbar:

- bleibt der gespeicherte Verweis sichtbar;
- erscheint ein kurzer neutraler Status, z. B. `Nicht verfügbar offline`;
- kein dominantes Fehlerpanel;
- keine automatische Löschung;
- Vorschau/Download werden entsprechend deaktiviert oder führen zu einer klaren Fehlermeldung.

### 8.8 Sicherheit lokaler Dateien

Unverändert zu erhalten:

- nur relative Pfade innerhalb freigegebener Wurzeln;
- Schutz vor Path Traversal;
- Blockierung von Symlinks;
- serverseitige Sitzungs- und Berechtigungsprüfung;
- MIME- und Vorschaupolicy;
- keine Offenlegung absoluter NAS-Pfade im UI.

## 9. Screen 4 – Einstellungen

### 9.1 Nutzerfrage

Wo verwalte ich mein Konto, meine Familie, Dokumentenzugriffe und den technischen App-Status?

### 9.2 Grundprinzip

Einstellungen sind eine kategorisierte Navigation und keine einzelne lange Formularseite. Technische oder seltene Details liegen eine Ebene tiefer.

### 9.3 Inhaltsreihenfolge

1. Titel und Hilfetext;
2. Konto-/Rollenzusammenfassung;
3. Personal;
4. Familie;
5. Dokumente;
6. System;
7. Bottom-Navigation ohne aktiven Haupttab.

### 9.4 Kontoübersicht

- Initialen-Avatar `J`;
- Nutzername Jona;
- Rolle Admin;
- Familie Kuthe;
- Chevron zur späteren Kontoseite.

### 9.5 Einstellungsgruppen

#### Personal

- Eigenes Passwort

#### Familie

- Haushaltsmitglieder, inklusive Anzahl;
- Rollen & Zugriffe

#### Dokumente

- Dokumentenablagen, inklusive Verbindungsstatus;
- NAS-Zugriffsrechte

#### System

- Synology & Speicher, mit kurzem Status;
- Notfall-Wiederherstellung, mit Einrichtungsstatus;
- Offline & Synchronisierung

### 9.6 Darstellungsregeln

- kleine Abschnittsüberschriften;
- kompakte Zeilen mit lokalem Icon, Text, optionalem Status und Chevron;
- keine Karten-in-Karten-Struktur;
- Grün bedeutet bereit/eingerichtet, muss aber durch Text ergänzt werden;
- technische Env-Werte und Anleitungen erscheinen erst in den Detailseiten;
- kein globaler Plus-Button.

## 10. Progressive Disclosure

Paket 2 zeigt auf den vier Übersichtsseiten nur die häufigsten Informationen und Einstiege.

Nachgelagert bleiben:

- Fahrzeugverwaltung und Excel-Setup;
- vollständige Verbrauchsanalyse;
- Vertragsbearbeitung, Preisphasen und Auto-Ausgaben;
- Dokumentenexplorer, Vorschau und Dateiauswahl;
- Rollen- und Root-Berechtigungsverwaltung;
- Synology-Details und Recovery-Formulare.

Alle bestehenden Funktionen müssen erreichbar bleiben. Sie dürfen nur neu gruppiert und visuell nachgelagert werden.

## 11. Explizite Nicht-Ziele von Paket 2

- keine Erstellen- oder Bearbeitungsformulare;
- kein NAS-Dateibrowser im Detail;
- keine Dokumentvorschau;
- keine Vertrags-Preisphasen;
- keine Auto-Analyse oder Jahresvergleichsausarbeitung;
- keine konkrete Filter-Sheet-Gestaltung;
- keine Desktop-Ansichten;
- keine freien Widgets;
- keine neuen fachlichen Berechnungen;
- keine Markenlogos.

## 12. Implementierungsregeln für Codex

1. Vor Paket 2 zuerst Paket 1 und danach dieses Dokument vollständig lesen.
2. `main` als funktionale Basis verwenden; Branch-Funktionen wie lokale NAS-Dateien gezielt und nachvollziehbar integrieren.
3. App-Shell, Suche, Filtericons, Navigation und FAB nicht seitenlokal neu erfinden.
4. Ausschließlich lokal gebündelte Icons aus der festgelegten Registry verwenden.
5. Keine dynamischen Iconnamen direkt ungeprüft als Komponenten importieren.
6. Markenlogos durch generische Vertragsart-Icons ersetzen.
7. `DRAFT` nicht entfernen; nur aus der primären Vertragsnavigation nehmen.
8. Bestehende Routen, Server Actions, Berechtigungen und Formularfeldnamen nicht ohne expliziten Auftrag ändern.
9. Dokumentensicherheit nicht in die UI-Schicht verschieben.
10. Bei 390 × 844 px auf Überlauf, FAB-Überdeckung und Touchziele prüfen.
11. Einstellungen in Unterseiten strukturieren, ohne administrative Funktionen zu verlieren.
12. Keine weitere ungeordnete CSS-Override-Schicht an eine historisch gewachsene globale Datei anhängen.

## 13. Akzeptanzkriterien

Paket 2 ist implementierungsseitig erfüllt, wenn:

- alle vier Seiten visuell und strukturell auf Paket 1 aufbauen;
- Auto, Verträge und Dokumente eingeklappte Suche sowie Filter zeigen;
- Einstellungen keine unnötige Suche und keinen FAB besitzt;
- der Plus-Button auf den anderen drei Seiten identisch positioniert und 56 px groß ist;
- Auto Fahrzeug, Zeitraum, vier Kennzahlen und Tankstopps kompakt zeigt;
- Verträge nur `Aktiv` und `Beendet` als primäre Tabs zeigt;
- Vertragsentwürfe weiterhin über Filter erreichbar und funktional erhalten sind;
- keine Anbieter- oder Markenlogos verwendet werden;
- alle Vertrags-, Kategorie- und Dokumenticons lokal gebündelt sind;
- Dokumente gespeicherte Links und lokale NAS-Dateien unterscheiden kann;
- lokale Dateien keine absoluten NAS-Pfade offenlegen;
- fehlende lokale Dateien als neutraler Status behandelt werden;
- Einstellungen als gruppierte Navigation statt als langes Formular umgesetzt sind;
- kein horizontaler Seitenoverflow bei 390 px entsteht;
- Navigation und FAB keine wichtigen Inhalte überdecken;
- bestehende Datenlogik, Rechte, Offlinefunktion und Automatisierungen unverändert funktionieren.

## 14. Offene Punkte für spätere Pakete

- konkrete Auto-Erstellungs- und Analyseflows in Paket 6;
- Vertragsformulare, Preisphasen und Kündigungslogik in Paket 7;
- Dokumentenbrowser, Vorschau und Verknüpfungen in Paket 8;
- administrative Detailseiten und Berechtigungsverwaltung in Paket 9;
- finale Icon-Registry mit deutschen Suchsynonymen;
- geöffnete Such- und Filterzustände;
- Lade-, Offline-, Fehler- und Leerzustände.

