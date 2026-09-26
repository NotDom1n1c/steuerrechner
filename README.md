# Schweizer Steuerrechner

Vollstaendig clientseitige Web-Applikation zur Berechnung und zum Vergleich der
Schweizer Einkommenssteuer in den Kantonen **AG, BE, BS, ZG und ZH** (gemaess
Aufgabenstellung). SOL-1-Schulprojekt der Klasse INFEFZ.1 BS, Lehrjahr 1.

> **Datenqualitaet statt -quantitaet:** Alle Tarife und Steuerfuesse stammen aus
> den offiziellen ESTV-Grunddaten. Es werden **bewusst keine Platzhalter- oder
> Demo-Werte** verwendet. Die Architektur ist erweiterbar – weitere Kantone
> lassen sich jederzeit ueber `scripts/build_real_data.py` aus ESTV-Daten ergaenzen.

## Features

- **5 Kantone** (AG, BE, BS, ZG, ZH) je mit Hauptort + 2 weiteren Gemeinden, echte ESTV-Daten
- **Bundessteuer** (DBG Art. 36) fuer Ledige und Verheiratete
- **Vermoegenssteuer** (Nettovermoegen) je Kanton, mit Freibetraegen
- **Live-Berechnung** beim Tippen (debounced)
- **Berechnungsweg-Toggle**: zeigt Stufe fuer Stufe wie sich die Steuer aufbaut
- **Marginal- und Durchschnittssatz**
- **Progressionskurve** (Linendiagramm 0 - 500'000 CHF)
- **Saeule-3a-Slider** mit Live-Anzeige der Steuerersparnis
- **Reverse Search**: Wunsch-Netto/Monat -> benoetigtes Brutto pro Kanton
- **Kantonsvergleich** mit Tabelle, Stacked-Bar-Chart und Differenz-Spalte ("Was kostet ein Umzug?")
- **CSV-Export** der Vergleichstabelle
- **Dark Mode**
- **URL-State**: Link teilen mit pre-filled Form
- **Gespeicherte Szenarien** (localStorage, Limit 50, mit Vergleichsmodus)
- **Apostroph-Tausender** in Eingabe (`80'000`)
- Responsive ab 320 px Breite
- Keine Frameworks. Keine Build-Tools. Vanilla HTML/CSS/JS.

## Wie starten

1. Repository klonen oder ZIP entpacken.
2. `index.html` im Browser oeffnen (Doppelklick funktioniert dank `data/embedded.js` Fallback).

> **Empfohlen:** lokaler HTTP-Server fuer saubere Module-Loads:
>
> ```bash
> python -m http.server 8000
> # oder: npx serve .
> ```
> Dann <http://localhost:8000> oeffnen.

## Tests

`tests/tests.html` im Browser oeffnen. Der Runner laedt `testcases.js`,
fuehrt **23 Testfaelle** aus und zeigt eine gruene/rote Liste.

## Verzeichnisstruktur

```
steuerrechner/
  index.html              Hauptseite
  README.md
  src/
    js/
      main.js             UI + Event Handling
      calc.js             Reine Berechnungsfunktionen (testbar, ohne DOM)
      storage.js          localStorage-Wrapper mit try/catch
      chart.js            Chart.js Aufrufe (Bar + Line)
      validate.js         Input-Validierung
    css/
      reset.css
      main.css            Design ("Swiss poster"), Light/Dark Theme, Breakpoints
  data/
    bundessteuer_2026.json   (Bund-Tarif, Stand 2025)
    kanton_ag.json  kanton_be.json  kanton_bs.json
    kanton_zg.json  kanton_zh.json
    embedded.js              Auto-generierter Inline-Fallback fuer file://
  tests/
    tests.html               Browser-Test-Runner
    testcases.js             23 Testfaelle
  scripts/
    build_real_data.py       ESTV-Excel (docs/sources) -> data/*.json
    generate_embedded.js     Erzeugt data/embedded.js aus den JSONs
  docs/
    quellen.md               ESTV-Quellen + Abrufdatum
    architektur.md           Kurze Architekturuebersicht
    sources/                 Original-ESTV-Excel (Tarife + Steuerfuesse)
```

## Hinweis zu den Tarifdaten (WICHTIG)

**Alle Daten sind echt.** Einkommens- und Vermoegenstarife sowie Steuerfuesse
fuer **AG, BE, BS, ZG, ZH und den Bund** stammen aus den offiziellen
ESTV-Grunddaten (Stand 2025/2026, Quelle ESTV swisstaxcalculator). Die
Original-Excel liegen unter `docs/sources/`, die Umwandlung macht
`scripts/build_real_data.py`. Es gibt **keine** Platzhalter.

**Warum nur diese 5 Kantone?** Die Aufgabenstellung definiert exakt diese
Kantone (BS, ZH, ZG, BE, AG). Bewusste Entscheidung gegen erfundene Demo-Daten
fuer weitere Kantone – Nachvollziehbarkeit und Datenqualitaet haben Vorrang.
Quellen im Detail: [docs/quellen.md](docs/quellen.md).

Workflow bei Datenaenderung:
1. Neue ESTV-Excel in `docs/sources/` ablegen.
2. `python scripts/build_real_data.py` (Excel → JSON).
3. `node scripts/generate_embedded.js` (JSON → `data/embedded.js` Fallback).
4. Erwartungswerte in `tests/testcases.js` neu berechnen/abgleichen.

Wird das Projekt auf ein anderes Jahr aktualisiert, sind alle JSON-Files
**und** die `expected`-Werte in `tests/testcases.js` anzupassen.

## Architektur in einem Satz

`index.html` haelt das Markup, `main.js` haengt am DOM und ruft reine
Funktionen aus `calc.js` auf, die mit `data/*.json` rechnen; gespeichert wird
ueber `storage.js` in localStorage; gezeichnet wird ueber `chart.js`/Chart.js.
Details: [docs/architektur.md](docs/architektur.md).

## Browser-Support

- Chrome / Edge ab Version 100
- Firefox ab Version 100
- Safari (Desktop und iOS) ab Version 15

Mobile-first ab 320 px Bildschirmbreite getestet.

## Cache-Bust

Beim Aktualisieren von JS/CSS den Versions-Query (`?v=2` -> `?v=3`) in
`index.html` und `tests/tests.html` erhoehen oder im Browser einen
Hard-Reload (`Ctrl+Shift+R` / `Cmd+Shift+R`) ausloesen.

## Lizenz

MIT (Schulprojekt). Siehe [docs/quellen.md](docs/quellen.md) fuer Quellen-Lizenzen
externer Daten - diese unterliegen den jeweiligen Nutzungsbedingungen.
