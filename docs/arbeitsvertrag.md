# Arbeitszeit, Überstunden und Urlaub – Regeln in Chronify

Dieses Dokument beschreibt, wie Chronify (Stand v1.0.2) Arbeitszeit, Überstunden,
Urlaub und Krankheit verrechnet. Es dient als Grundlage für die Arbeitsverträge
bzw. eine Betriebsvereinbarung. Wo die App etwas technisch festlegt, das
vertraglich noch nicht geregelt ist, steht es unter [Noch zu klären](#noch-zu-klären).

> Kein Rechtsrat. Vor Verwendung in Verträgen arbeitsrechtlich prüfen lassen.

## 1. Arbeitszeitmodell

- Für jeden Mitarbeiter ist ein **Arbeitszeitmodell** hinterlegt, mit der
  Soll-Arbeitszeit pro Wochentag (Mo–So, in Stunden und Minuten).
- Ein Wochentag mit **0 Stunden ist ein arbeitsfreier Tag**. Beispiel
  4-Tage-Woche: Mo–Do je 8 h, Fr 0 h.
- Ändert sich der Vertrag, wird ein neues Modell **ab einem Stichtag** angelegt.
  Vor dem Stichtag gilt das alte Modell, ab dem Stichtag das neue.
- Gesetzliche Feiertage des Bundeslandes des Mitarbeiters (Standard: NRW) sind
  arbeitsfrei und haben kein Soll.

| Modell (Beispiele)                | Mo  | Di  | Mi  | Do  | Fr  | Woche |
| --------------------------------- | --- | --- | --- | --- | --- | ----- |
| Vollzeit 40 h                     | 8   | 8   | 8   | 8   | 8   | 40 h  |
| 4-Tage-Woche 32 h                 | 8   | 8   | 8   | 8   | 0   | 32 h  |
| Teilzeit 30 h (ungleich verteilt) | 8   | 8   | 4   | 6   | 4   | 30 h  |

## 2. Arbeitszeiterfassung und Pausen

- Erfasst wird per Timer (Web/App, NFC-Kiosk) oder manuell im Stundenzettel.
- Mitarbeiter können eigene Einträge **bis 7 Tage rückwirkend** anlegen oder
  ändern (einstellbar). Ältere Einträge kann nur ein Admin ändern.
- **Pausen nach § 4 ArbZG:** Im Modus „Automatik“ werden abgezogen:
  - mehr als 6 h Arbeitszeit → 30 Minuten
  - mehr als 9 h Arbeitszeit → 45 Minuten

  Im Modus „Manuell“ trägt der Mitarbeiter die Pause selbst ein. Die App warnt,
  wenn die Pause unter dem gesetzlichen Minimum liegt.

- **Hinweise nach ArbZG:** Ab 8 h Arbeitszeit am Tag gibt es einen Hinweis, ab
  10 h eine Warnung, ebenso bei weniger als 11 h Ruhezeit zwischen zwei
  Arbeitstagen. Die Erfassung wird dadurch nicht blockiert.

## 3. Überstunden

### 3.1 Berechnung

- Pro Arbeitstag gilt: **Überstunden = gearbeitete Zeit (ohne Pause) − Soll laut
  Modell**, auf volle Minuten abgerundet.
- Das Ergebnis kann positiv (Überstunden) oder negativ (Minusstunden) sein.
- Ein Arbeitstag ohne Zeiterfassung und ohne Abwesenheit zählt mit dem vollen
  Soll als Minus.
- Tage mit genehmigtem Urlaub, Krankmeldung oder Feiertag zählen ±0, sofern an
  dem Tag nicht gearbeitet wurde.
- Gezählt werden nur Tage bis gestern. Der laufende Tag fließt erst am Folgetag ein.

### 3.2 Überstundenkonto

- **Kontostand = Übertrag aus dem Vorjahr + Summe der Tagessalden des Jahres −
  abgebaute Überstunden.**
- Das Konto **darf ins Minus gehen**: wenn zu wenig gearbeitet wurde, wenn
  Überstunden abgebaut werden, die nicht vorhanden sind, oder bei Schließtagen
  ohne Resturlaub (siehe 5).
- Es gibt keine Obergrenze und keinen Verfall. Der Saldo wird vollständig ins
  nächste Jahr übertragen (siehe 7).

### 3.3 Überstunden abbauen („abfeiern“)

- Freie Tage werden als Antrag mit der Option „Über Überstunden abrechnen“
  gestellt und vom Admin genehmigt.
- Abgezogen werden **genau die Soll-Stunden des jeweiligen Tages laut Modell**.

  Beispiele: Freitag im 40-h-Modell → 8 h. Mittwoch im Teilzeitmodell mit 4 h → 4 h.
  Ein Tag mit 0 h im Modell kostet nichts.

- **Halber Tag:** halbe Soll-Stunden des Tages, oder ein im Modell hinterlegter
  eigener Halbtagswert. Die andere Tageshälfte muss gearbeitet werden, sonst
  fehlt sie als Minus.

## 4. Urlaub

### 4.1 Anspruch

- Standard: **30 Urlaubstage pro Jahr** (in den Einstellungen änderbar).
  Pro Mitarbeiter kann ein abweichender Anspruch hinterlegt werden.
- Der individuell hinterlegte Anspruch **gilt auch in den Folgejahren weiter**,
  bis er geändert wird.
- Mitarbeiter mit **Regenerationstagen** erhalten zusätzlich 2 Tage pro Jahr.

### 4.2 Verbrauch

- Verbraucht werden **nur Tage, die laut Arbeitszeitmodell Arbeitstage sind**.
  Wochenenden, Feiertage und 0-h-Tage kosten keinen Urlaub.

  Beispiel: Eine Woche Urlaub (Mo–Fr) kostet bei Vollzeit 5 Tage, bei der
  4-Tage-Woche (Fr = 0 h) 4 Tage.

- **Halber Urlaubstag:** 0,5 Tage. Die andere Tageshälfte muss gearbeitet werden.
- Der Urlaub kann **nicht ins Minus** gehen. Ein Antrag wird abgelehnt, wenn
  der Resturlaub nicht reicht. Offene (noch nicht genehmigte) Anträge werden
  dabei schon abgezogen.
- **Sonderurlaub** (z. B. Hochzeit, Umzug) wird derzeit ebenfalls vom
  Urlaubsanspruch abgezogen (siehe Noch zu klären).

## 5. Betriebsferien / Schließtage

- Die Firma legt Schließtage fest. Für jeden Mitarbeiter wird automatisch Urlaub
  eingetragen, **nur für seine Arbeitstage laut Modell**. Beispiel: Ein
  Schließtag am Freitag kostet bei der 4-Tage-Woche (Fr = 0 h) nichts.
- Hat ein Mitarbeiter an dem Tag bereits genehmigten Urlaub, wird der Tag
  nicht doppelt verrechnet.
- Der Mitarbeiter kann statt Urlaub **Überstunden** wählen. Dann werden die
  Soll-Stunden der Schließtage vom Überstundenkonto abgezogen.
- **Reicht der Resturlaub nicht**, wird der Schließtag automatisch über das
  Überstundenkonto verrechnet (auch ins Minus). Der Mitarbeiter wird benachrichtigt.
- Bereits begonnene Schließtage können nicht mehr gelöscht werden.

## 6. Heiligabend (24.12.) und Silvester (31.12.)

- Beide Tage sind **halbe Arbeitstage** (für jeden Tag einzeln abschaltbar).
  Die erste Hälfte ist frei.
- Die zweite Hälfte bucht der Mitarbeiter selbst: als **halben Urlaubstag
  (0,5 Tage)** oder als **halben Überstundentag** (halbe Soll-Stunden des Tages).
  Alternativ arbeitet er die halbe Schicht.
- Wird weder gearbeitet noch gebucht, fehlt nur die halbe Soll-Zeit als Minus.

## 7. Jahreswechsel

- Läuft vollautomatisch, es ist keine Aktion nötig.
- **Resturlaub wird vollständig ins neue Jahr übertragen und verfällt nicht.**
- **Der Überstundensaldo wird vollständig übertragen** (positiv wie negativ)
  und verfällt nicht.
- Korrekturen im alten Jahr (z. B. ein nachgetragener Dezembertag) wirken sich
  automatisch auf den Übertrag ins neue Jahr aus.
- Die Feiertage des Folgejahres werden ab Dezember automatisch geladen.

## 8. Krankheit

- Krankmeldungen erfasst der Mitarbeiter selbst. Ein Admin kann sie für
  Mitarbeiter nachtragen, auch rückwirkend.
- Krankheitstage zählen für die Überstunden ±0.
- Das Datum der **AU-Bescheinigung** wird miterfasst. Fehlt es, wird der
  Mitarbeiter per E-Mail erinnert.
- **Krank im Urlaub (§ 9 BUrlG):** Durch AU nachgewiesene Krankheitstage
  während eines genehmigten Urlaubs werden **nicht als Urlaub angerechnet**.
  Die Tage gehen auf das Urlaubskonto zurück. Das gilt für Erholungsurlaub und
  Schließtage.
  - Ohne AU-Bescheinigung bleibt der Urlaub verbraucht.
  - Wird die AU nachgereicht, wird der Urlaub dann zurückgegeben.
  - Wird die Krankmeldung gelöscht oder gekürzt, wird der Urlaub wieder gebucht.
  - Überstunden-Abbautage, Sonderurlaub und Regenerationstage werden bei
    Krankheit **nicht** zurückgegeben.

## Noch zu klären

**Urlaubsanspruch**

1. **Urlaub bei Teilzeit / weniger Arbeitstagen:** Die App gibt allen
   Mitarbeitern standardmäßig 30 Tage, unabhängig von der Zahl der Arbeitstage
   pro Woche. Rechtlich üblich ist eine Umrechnung: 30 Tage bei 5 Tagen/Woche →
   24 Tage bei 4 Tagen/Woche (30 × 4 / 5). Da eine 4-Tage-Woche pro
   Urlaubswoche nur 4 Tage verbraucht, hätte sie mit 30 Tagen 7,5 statt 6
   Wochen Urlaub. Soll der Anspruch pro Mitarbeiter manuell gesetzt oder
   automatisch umgerechnet werden?
2. **Wechsel des Modells im Jahr** (z. B. von 5 auf 4 Tage ab Juli): Muss der
   Anspruch anteilig neu berechnet werden?
3. **Eintritt/Austritt im laufenden Jahr:** Die App gibt den vollen
   Jahresanspruch. Üblich ist 1/12 pro vollem Beschäftigungsmonat (§ 5 BUrlG,
   volle Zahlung nach Ablauf der Wartezeit von 6 Monaten). Welche Regel gilt?
4. **Verfall von Resturlaub:** Die App überträgt Resturlaub unbegrenzt.
   Gesetzlich verfällt Urlaub grundsätzlich am 31.12. bzw. bei Übertragung am
   31.03. des Folgejahres, aber nur, wenn der Arbeitgeber rechtzeitig auf den
   drohenden Verfall hingewiesen hat. Soll Resturlaub unbegrenzt übertragen
   werden (so ist es jetzt), oder sollen eine Frist und Hinweise eingeführt werden?
5. **Sonderurlaub:** Wird derzeit vom Jahresurlaub abgezogen. Üblicherweise ist
   Sonderurlaub eine zusätzliche bezahlte Freistellung (§ 616 BGB, Tarif). Soll
   er den Urlaub nicht mehr belasten? Für welche Anlässe und wie viele Tage?
6. **Regenerationstage:** Gibt es sie für alle oder nur für bestimmte
   Mitarbeiter? Wie viele? Gehen sie bei Krankheit zurück (abhängig vom Tarif)?
   Verfallen sie am Jahresende?

**Überstunden**

7. **Obergrenzen:** Gibt es eine Höchstgrenze für Plus- bzw. Minusstunden
   (z. B. ±40 h)? Die App kennt keine Grenzen.
8. **Abgeltung:** Werden Überstunden nur durch Freizeit ausgeglichen oder
   (auch) ausbezahlt? Gibt es pauschal abgegoltene Überstunden („mit dem Gehalt
   abgegolten bis X h/Monat“)?
9. **Anordnung:** Zählen alle erfassten Mehrstunden, oder nur angeordnete bzw.
   genehmigte?
10. **Minusstunden beim Austritt:** Werden sie mit dem Gehalt verrechnet?
11. **Verfall von Überstunden:** Die App überträgt den Saldo unbegrenzt. Soll das
    vertraglich so bleiben?

**Arbeitszeit und Pausen**

12. **Pausen-Modus:** Automatische Pausen (vom System abgezogen) oder manuelle
    Erfassung? Für alle gleich oder pro Mitarbeiter?
13. **Rundung:** Die App rechnet minutengenau (abgerundet). Ist das gewünscht,
    oder soll z. B. auf 15 Minuten gerundet werden?
14. **Korrekturfrist:** Mitarbeiter können 7 Tage rückwirkend korrigieren. Ist
    diese Frist richtig?
15. **Arbeitszeit über 10 h / Ruhezeit unter 11 h:** Die App warnt nur. Sollen
    solche Einträge blockiert oder vom Admin bestätigt werden?

**Schließtage, Feiertage, Krankheit**

16. **Schließtage ohne Resturlaub:** Die App bucht sie automatisch über das
    Überstundenkonto, auch ins Minus. Ist das vertraglich so vereinbart
    (Betriebsferien müssen im Vertrag bzw. in einer Betriebsvereinbarung stehen)?
17. **24.12./31.12.:** Ist die freie Hälfte eine bezahlte Freistellung durch den
    Arbeitgeber? Gilt sie auch, wenn der Tag auf einen 0-h-Tag oder ein
    Wochenende fällt (aktuell: kein Ausgleich)?
18. **Feiertage am 0-h-Tag:** Fällt ein Feiertag auf einen freien Tag der
    Teilzeitkraft, gibt es keinen Ausgleich (gesetzlicher Standard). Ist das so
    gewollt?
19. **AU-Pflicht:** Ab welchem Krankheitstag muss eine AU vorgelegt werden
    (gesetzlich ab dem 4. Kalendertag, vertraglich auch früher möglich)?
20. **Bundesland:** Gelten für alle Mitarbeiter die NRW-Feiertage, oder je nach
    Wohn- bzw. Arbeitsort andere?
