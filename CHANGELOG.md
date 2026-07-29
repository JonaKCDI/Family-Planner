# Changelog

## 2026-07-29 - Finanzplanung, mobile Oberflaeche und Aufgaben-Popup

### Neu

- Neue Ausgaben-Planungsanalyse mit Prisma-Modellen fuer manuelle Behandlungen und wiederverwendbare Regeln.
- Neue Planungsansicht fuer Ausgaben mit Erkennung von Fixkosten, Sondereffekten, Rueckerstattungen, Spar-/Investmentposten und planungsirrelevanten Buchungen.
- Erweiterte Finanzfilter, Toolbar-Komponenten und URL-Filterlogik fuer alltagstauglichere mobile Auswertungen.
- Kategorie-Icons und Icon-Auswahl als Grundlage fuer ruhigere, besser scannbare Finanzuebersichten.
- Dokumentierte UI-Leitlinien fuer die freigegebene Aufgaben-Mobile-UI als Referenz fuer kommende Seiten.

### Geaendert

- Ausgaben-, Kilometer- und Vertragsseiten wurden an das kompakte, mobile-first Aufgabenmuster angeglichen.
- Aufgaben-Details und Aufgaben-Bearbeitung nutzen jetzt ein read-first Detail-Sheet und ein eigenes Edit-Sheet im Stil der Erstellung.
- Globale Create- und Action-Sheets wurden fuer mobile PWA-Nutzung vereinheitlicht: feste Sheet-Hoehen, bessere Footer, ruhigere Header und stabilere Scrollbereiche.
- Suchbare Selects unterstuetzen Quick-Add-Flows fuer Kategorien und Labels.
- Ausgabenanalyse beruecksichtigt Einnahmen und Saldo konsistenter in Kategorie-, Label- und Zeitraumsauswertungen.

### Behoben

- Aufgaben-Erstellung wurde wieder auf das freigegebene Popup-Verhalten zurueckgesetzt: transparente Sektionen, volle Submit-Breite, kein verdeckender Navigations-/Scroll-Puffer und keine grauen Card-Flaechen im Sheet.
- Mobile Bottom-Navigation und globale Scroll-Safety-Regeln stoeren Create-Sheets nicht mehr.
- Sortier- und Filter-Sheets bleiben kompakt und lassen die letzte Aktion erreichbar.
- Offline-/Sync- und Filterlogik wurde robuster gegen unpassende oder fehlende Filterparameter.

### Dokumentation

- `docs/UI_GUIDELINES.md` beschreibt die verbindlichen Aufgaben-, Sheet-, Detail- und NAS-Picker-Muster.
- `DESIGN.md` und `AGENTS.md` wurden um die aktuellen Design- und Koordinationsentscheidungen ergaenzt.

### Validierung

- `npm.cmd run lint`
- Mobiler Smoke der Aufgaben-Erstellung bei `390 x 844`: Sheet oeffnet, Submit-Button ist voll sichtbar und 48px hoch.
