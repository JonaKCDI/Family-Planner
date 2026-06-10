# Backlog

## Monatswechsel in der Ausgabenübersicht

Ziel: In der Ausgaben-/Einnahmenübersicht soll der angezeigte Monat schnell gewechselt werden können.

Idee:
- In der Monatsansicht kompakte Pfeile für vorherigen und nächsten Monat anzeigen.
- Der aktuell angezeigte Monat bleibt sichtbar, z. B. "Juni 2026".
- Beim Wechsel bleiben Suche, Kategorie und Label-Filter erhalten.
- Jahres- und freie Zeitraumansichten bleiben unverändert; die Pfeile führen gezielt in die Monatsansicht.
- Mobile Darstellung iPhone-tauglich und ohne dauerhaftes Erfassungsformular.

Offene Entscheidungen:
- Position festlegen, z. B. oberhalb der Kennzahlen oder direkt im Zeitraum-Filter.
- Klären, ob der Wechsel beliebig in zukünftige Monate führen darf oder optional beim aktuellen Monat endet.

## Wiederkehrende Einnahmen und Ausgaben

Ziel: Neben Vertragsausgaben sollen frei definierbare wiederkehrende Buchungen möglich sein, z. B. Gehalt, Kindergeld, Miete, Daueraufträge, Sparraten oder regelmäßige Haushaltsausgaben.

Idee:
- Eigener Bereich "Wiederkehrende Buchungen" in Ausgaben oder Einstellungen.
- Art: Einnahme oder Ausgabe.
- Betrag, Kategorie, Label, Bezahlart, Laden/Quelle und optionale Beschreibung.
- Intervall: monatlich, quartalsweise, jährlich.
- Startdatum, optional Enddatum, nächster Buchungstermin.
- Aktiv/pausiert.
- App erzeugt fällige Buchungen automatisch als normale private Ausgaben/Einnahmen.
- Pro Fälligkeit darf nur ein Eintrag entstehen, damit keine Duplikate erzeugt werden.
- Bereits erzeugte Buchungen bleiben erhalten, auch wenn die Vorlage später pausiert oder gelöscht wird.
- Preisänderungen können mit "Gültig ab" gepflegt werden, damit automatische Buchungen ab diesem Datum den neuen Betrag nutzen.
- Die Detailansicht zeigt die Betragshistorie, z. B. 20 EUR/Monat von Datum X bis Datum Y, danach 25 EUR/Monat ab Datum Y.

UI:
- Keine separate Hauptübersicht und kein eigener dauerhaft sichtbarer Bereich für wiederkehrende Buchungen.
- Wiederkehrende Buchungen werden in die allgemeine Ausgaben-/Einnahmen-Übersicht integriert.
- Verwaltung und Erstellung laufen über einen eigenen kurzen Menüpunkt bzw. eine Aktion neben "Filter" und "Setup" auf der Ausgabenseite.
- Der Menüpunkt öffnet ein Pop-up bzw. eine umfangreichere Modal-Ansicht ähnlich wie "Setup".
- Neue wiederkehrende Buchungen werden nur in dieser Verwaltungsansicht erstellt, nicht über den globalen Plus-Button.
- Der globale Plus-Button bleibt für schnelle Erfassung unterwegs reserviert.
- Die Ausgabenliste bleibt primär eine Liste echter gebuchter Einträge; automatisch erzeugte Einträge erscheinen dort normal mit dezentem Quellenhinweis.
- Wiederkehrende Buchungen sind zunächst nur privat pro Nutzer, nicht Familie/Privat umschaltbar.

Offene Entscheidungen:
- Keine offenen Entscheidungen zur Erzeugung und Vorschau.
- Kurze Bezeichnung für den Menüpunkt festlegen, z. B. "Regeln", "Serien", "Fixes" oder "Dauernd".

Entschieden:
- Fällige wiederkehrende Buchungen werden automatisch erzeugt.
- Automatisch erzeugte Buchungen zeigen ihre Quelle dezent an, z. B. Vertrag oder Vorlage, ohne die Ausgabenliste optisch zu überladen.
- Es gibt keine Vorschau der nächsten wiederkehrenden Buchungen.
- Beim Bearbeiten eines bestehenden Betrags ist "Gültig ab" der Standard, damit Preisänderungen als neue Phase gespeichert werden.
- Wenn eine Preisänderung rückwirkend gilt und bereits automatisch erzeugte Buchungen betrifft, bietet die App eine Aktualisierung dieser bestehenden Einträge an.

## Vertragsausgaben mit Kategorie

Ziel: Bei Verträgen, die automatisch Ausgaben erzeugen, soll eine Kategorie für die erzeugte Ausgabe gewählt werden können.

Idee:
- Vertragsformular um ein Feld "Ausgaben-Kategorie" erweitern.
- Optional zusätzlich Label/Projekt prüfen, falls Vertragskosten projektbezogen ausgewertet werden sollen.
- Automatisch erzeugte Vertragsausgaben übernehmen die gewählte Kategorie.
- Bestehende Verträge ohne Kategorie bleiben gültig und erzeugen weiterhin Ausgaben ohne Kategorie.
- Vertragsausgaben unterstützen monatliche, quartalsweise und jährliche Intervalle konsistent mit wiederkehrenden Buchungen.

Offene Entscheidungen:
- Keine offenen Entscheidungen zur Kategorie.

Entschieden:
- Die Ausgaben-Kategorie ist optional, auch wenn "Automatisch als Ausgabe eintragen" aktiv ist.
- Wenn die Vertragskategorie geändert wird, bietet die App an, bereits automatisch erzeugte Vertragsausgaben entsprechend zu aktualisieren.

## Preisentwicklung bei Verträgen und wiederkehrenden Buchungen

Ziel: Preisänderungen bei bestehenden Verträgen und regelmäßigen Einnahmen/Ausgaben sollen nachvollziehbar bleiben, statt den alten Betrag einfach zu überschreiben.

Idee:
- Beim Bearbeiten eines bestehenden Vertrags oder einer wiederkehrenden Buchung kann ein Datum "Gültig ab" gesetzt werden.
- Die App speichert Beträge als Historie mit Zeitraum, Betrag, Währung und Intervall, z. B. 20 EUR/Monat von 2026-01-01 bis 2026-06-30 und 25 EUR/Monat ab 2026-07-01.
- Automatisch erzeugte Ausgaben/Einnahmen verwenden den Betrag, der am jeweiligen Fälligkeitsdatum gültig ist.
- Übersichten zeigen den aktuellen Betrag prominent und die Entwicklung in einer kompakten Historie.
- Manuelle Änderungen können wahlweise den aktuellen Eintrag korrigieren oder als neue Preisphase ab einem Datum angelegt werden.

Offene Entscheidungen:
- Keine offenen Entscheidungen zur Historie und zum Export.

Entschieden:
- Quartalsweise bedeutet alle 3 Monate ab Startdatum bzw. Ankerdatum, nicht feste Kalenderquartale.
- Preisphasen dürfen Lücken haben, z. B. für pausierte oder nicht berechnete Zeiträume.
- Beim Bearbeiten eines bestehenden Betrags ist "Gültig ab" der Standard.
- Rückwirkende Änderungen bieten optional an, bereits automatisch erzeugte Buchungen im betroffenen Zeitraum zu aktualisieren.
- Exporte enthalten keine separate Preis-Historie; die erzeugten Ausgaben/Einnahmen bilden die jeweils gültigen Beträge ab.
