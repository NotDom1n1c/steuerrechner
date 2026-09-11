# Architektur

## Ueberblick

```
+------------------------------------------------------+
|                    Browser                            |
|                                                       |
|  +--------------+    +-------------+    +----------+ |
|  | index.html   |--->|  main.js    |--->| calc.js  | |
|  | (DOM)        |    | UI-Glue     |    | (rein)   | |
|  +--------------+    +-------------+    +----------+ |
|                            |                  ^      |
|                            |                  |      |
|                            v                  |      |
|         +----------+   +----------+   +--------------+|
|         |chart.js  |   |storage.js|   | data/*.json  ||
|         |(Chart.js)|   |(Local-   |   | (Tarife)     ||
|         |Bar+Line  |   | Storage) |   | + embedded.js||
|         +----------+   +----------+   +--------------+|
+------------------------------------------------------+
```

## Schichten

| Schicht        | Datei                | Verantwortung                              |
|----------------|----------------------|--------------------------------------------|
| Daten          | `data/*.json`        | Tariftabellen Bund + 5 Kantone (AG/BE/BS/ZG/ZH) |
| Daten-Inline   | `data/embedded.js`   | Auto-generiert; Fallback fuer file://      |
| Logik (rein)   | `src/js/calc.js`     | Steuerberechnung, keine Seiteneffekte      |
| Validierung    | `src/js/validate.js` | Eingabepruefung, gibt Fehlerlisten zurueck |
| Persistenz     | `src/js/storage.js`  | localStorage-CRUD, Quota-Schutz            |
| Visualisierung | `src/js/chart.js`    | Chart.js Bar (Vergleich) + Line (Progression) |
| UI-Glue        | `src/js/main.js`     | DOM-Events, Daten laden, Render            |
| Markup         | `index.html`         | Semantische Struktur                       |
| Styling        | `src/css/*`          | Mobile-first, Light + Dark Theme           |
| Werkzeuge      | `scripts/*.js`       | Generatoren fuer Kantonsdaten + embedded   |

## Designentscheidungen

### Reine Berechnungsfunktionen

`calc.js` greift bewusst nicht auf das DOM zu. Das macht die Funktionen
testbar (siehe `tests/`) und erlaubt es, den Steuer-Code in andere Kontexte
(Node-Skript, Worker) zu portieren, ohne UI-Anpassungen vornehmen zu muessen.

### Rappen-Arithmetik

Alle internen Geldbetraege werden in Rappen (Ganzzahlen) verarbeitet.
Erst bei der Anzeige wird durch 100 geteilt und auf zwei Nachkommastellen
gerundet. Das vermeidet IEEE-754-Drift wie `0.1 + 0.2 !== 0.3`.

### Tarif-Datenmodell

Jede Stufe ist `{ bis, fix, satz, ueber }`:

- `bis` = Obergrenze des Einkommens fuer diese Stufe (`null` = keine).
- `fix` = Sockelbetrag fuer das untere Ende der Stufe.
- `satz` = Grenzsteuersatz (Dezimal, z.B. `0.07` fuer 7 %).
- `ueber` = Untergrenze, ab der `satz` greift.

Steuer = `fix + satz * max(0, einkommen - ueber)`.

Die obersten Stufen koennen `_pauschal: true` markiert sein (z.B. Bund:
oberhalb der Schwelle wird `satz` aufs gesamte Einkommen angewendet).

### Kantonsmodell

```text
Total Kanton = einfache_steuer * (kantonsfuss + gemeindefuss + kirchenfuss) / 100
```

Die einfache Steuer wird pro Kanton aus `tarif_ledig` / `tarif_verheiratet`
berechnet. Die Steuerfuesse sind in Prozent. Kirche ist 0, wenn Konfession
"keine".

**Datenmodell `gemeinden`:** Jede Gemeinde traegt ihren eigenen Gemeinde- und
Kirchensteuerfuss: `{ "Zürich": { "fuss": 119, "rk": 10, "ev": 10 } }`. Die
Kirchensteuer ist also pro Gemeinde hinterlegt (echte ESTV-Werte: ref. = ev,
roem.-kt. = rk). `resolveGemeinde()` in `calc.js` liest das aus.

**Splitting (AG):** Aargau hat nur einen Tarif und besteuert Verheiratete per
**Vollsplitting (Faktor 2)**: `tax(E) = 2 * tarif(E/2)`. Das wird beim Daten-Build
(`scripts/build_real_data.py`) als verdoppelte Schwellen/Sockel in
`tarif_verheiratet` materialisiert – die Engine bleibt unveraendert.

**Vermoegenssteuer:** Optionales Feld „Nettovermoegen". Jeder Kanton hat
`tarif_vermoegen_ledig` / `tarif_vermoegen_verheiratet` (gleiches Stufen-Schema).
Die einfache Vermoegenssteuer wird mit demselben Steuerfuss (Kanton + Gemeinde +
Kirche) multipliziert wie die Einkommenssteuer und zum Total addiert. Der Bund
kennt keine Vermoegenssteuer. Ohne Eingabe (`vermoegen = 0`) bleibt das Resultat
identisch zur reinen Einkommensberechnung (rueckwaertskompatibel).

### Live-Berechnung mit Debounce

Eingabeaenderungen triggern `rechnen()` ueber einen 200 ms Debounce-Timer.
Das verhindert Re-Rendering bei jedem Tastenanschlag, ohne traegt zu wirken.

### Berechnungsweg-Trace (didaktisch)

`calc.js` exportiert `traceBundessteuer` und `traceKanton`, die ein
Array von Erklaerungs-Strings zurueckgeben. Im UI per Toggle anzeigbar.
Das macht aus dem Rechner ein Lernwerkzeug.

### Saeule 3a

Die Einzahlung wird vom steuerbaren Einkommen abgezogen. Der Vorteil ist
die Differenz zwischen Steuer mit und ohne Abzug.

### Reverse Search (binaere Suche)

Sucht das Brutto-Einkommen, bei dem das Netto pro Monat dem Wunschwert
entspricht. Maximal 30 Iterationen, Toleranz 60 CHF/Jahr. Pro Kanton
einmal.

### Persistenz

Gespeichert werden ausschliesslich die Eingaben (kein Resultat-Caching).
Der Wrapper in `storage.js` faengt `QuotaExceededError` ab und liefert
benutzerfreundliche Fehlermeldungen. JSON-Parse-Fehler loeschen den
korrupten Eintrag und informieren den User.

### URL-State

Jede Berechnung schreibt die Eingabewerte als Query-Parameter in die URL
(`history.replaceState`, kein Page-Reload). Beim Laden mit Parametern
wird die Form vorbefuellt. So kann man Berechnungen verlinken.

### Inline-Fallback (file://)

`data/embedded.js` wird vor den anderen Modulen geladen und setzt
`window.STEUER_DATA`. Falls vorhanden, ueberspringt `main.js` das `fetch()`
und nutzt die eingebetteten Daten. Damit funktioniert die App auch per
Doppelklick auf `index.html` ohne lokalen Server.

Generierung: `node scripts/generate_embedded.js`

### Dark Mode

Theme via `body[data-theme="light|dark"]`. Alle Farben sind CSS Custom
Properties, sodass das Umschalten nur ein Attribut-Wechsel ist. Persistenz
in localStorage.

### Cache-Busting

Versionsparameter im `<script src=".../main.js?v=2">`-Pattern. Beim
Aktualisieren wird `v` erhoeht; das zwingt Browser zum Neuladen, ohne
dass Dateinamen umbenannt werden muessen.

## Was bewusst NICHT gebaut wird

Siehe Aufgabenstellung. Zusammengefasst: kein Backend, keine Datenbank,
kein Login, keine externen APIs, keine Quellensteuer, keine Kapitalauszahlung
2. Saeule, keine Erbschafts-/Schenkungssteuer, keine Mehrsprachigkeit,
kein PDF-Export, keine Build-Tools.

Die `scripts/`-Generatoren sind bewusst KEIN Build-Step: sie werden manuell
einmalig ausgefuehrt und ihre Ergebnisse (`data/*.json`, `data/embedded.js`)
sind committed Dateien, die das Projekt direkt nutzt.
