# Quellen

## Datenstand

| Kanton | Daten | Jahr | Quelle |
|--------|-------|------|--------|
| **Bund** | echt | 2025 | ESTV Grunddaten (Tarife) |
| **ZH** | echt | 2026 | ESTV Grunddaten (Tarife + Steuerfuesse) |
| **BS** | echt | 2026 | ESTV Grunddaten (Tarife + Steuerfuesse) |
| **ZG** | echt | 2026 | ESTV Grunddaten (Tarife + Steuerfuesse) |
| **BE** | echt | 2025 | ESTV Grunddaten (Tarife + Steuerfuesse) |
| **AG** | echt | 2025 | ESTV Grunddaten (Tarife + Steuerfuesse, Vollsplitting Faktor 2) |

**Es werden ausschliesslich echte ESTV-Daten verwendet – keine Platzhalter.**
Der Umfang (AG, BE, BS, ZG, ZH) entspricht exakt der Aufgabenstellung; auf
erfundene Demo-Daten fuer weitere Kantone wurde bewusst verzichtet
(Nachvollziehbarkeit vor Quantitaet).

Die Echtdaten wurden am 2026-06-08 ueber den ESTV **swisstaxcalculator** bezogen
(Bereich „Grunddaten abrufen" → Datenart *Tarife* bzw. *Steuerfuesse*, Region
*Nach Kanton*, Steuerart *Einkommen* **und** *Vermoegen*). Die Original-Excel-Dateien
liegen unter `docs/sources/` (z. B. `tarif_zh_2026.xlsx`, `fuss_zh_2026.xlsx`,
`vermoegen_zh_2026.xlsx`). Umgewandelt in JSON durch `scripts/build_real_data.py`.

Hinweis Vermoegenssteuer: derselbe Gemeinde-/Kantons-/Kirchensteuerfuss multipliziert
sowohl die einfache Einkommens- als auch die einfache Vermoegenssteuer; der Bund
erhebt **keine** Vermoegenssteuer. Bei der Vermoegenssteuer wenden alle 5 Kantone
kein Splitting an (Faktor 0); ZH und BS haben getrennte Tarife fuer Ledige/Verheiratete,
AG/BE/ZG einen gemeinsamen Tarif.

> Hinweis: Bei den ESTV-Grunddaten ist das neuste Steuerjahr fuer manche Kantone
> erst 2025 verfuegbar (BE, AG). ZH/BS/ZG liegen bereits fuer 2026 vor.

## Offizielle Quellenseiten

## Bundessteuer

- **ESTV - Tariftabelle direkte Bundessteuer (DBG Art. 36), natuerliche Personen.**
  <https://www.estv.admin.ch/estv/de/home/direkte-bundessteuer/dbst-natuerliche-personen.html> · abgerufen am 2026-04-15
- **Bundesgesetz ueber die direkte Bundessteuer (DBG), SR 642.11.**
  <https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de> · abgerufen am 2026-04-15

## Kantonale Steuerverwaltungen (unterstuetzte Kantone)

| Kanton | Link | Abrufdatum |
|--------|------|------------|
| AG | <https://www.ag.ch/de/themen/steuern> | 2026-06-08 |
| BE | <https://www.taxme.sites.be.ch/> | 2026-06-08 |
| BS | <https://www.bs.ch/themen/steuern> | 2026-06-08 |
| ZG | <https://www.zg.ch/behoerden/finanzdirektion/steuerverwaltung> | 2026-06-08 |
| ZH | <https://www.zh.ch/de/steuern-finanzen/steuern.html> | 2026-06-08 |

## ESTV Steuerrechner (Referenz fuer Verifikation / Testprotokoll)

- ESTV swisstaxcalculator – Einkommens- und Vermoegenssteuer (Version 1.0.44).
  <https://swisstaxcalculator.estv.admin.ch/#/calculator/income-wealth-tax> · abgerufen am 2026-06-19
- ESTV swisstaxcalculator – Grunddaten abrufen (Tarife / Steuerfuesse).
  <https://swisstaxcalculator.estv.admin.ch/#/baseData> · abgerufen am 2026-06-08

## Lokale Sicherungskopien

Wichtige PDFs (Tariftabellen) sollten unter `/docs/sources/` lokal abgelegt
werden, damit das Projekt auch bei toten Links nachvollziehbar bleibt.

## Aktualisierungs-Checkliste

Bei Tarif-Update fuer ein neues Jahr:

1. Alle Werte in `/data/*.json` ersetzen, `"jahr"` und `"abgerufen"` anpassen.
2. `"_PLATZHALTER": true` entfernen, sobald die Daten validiert sind.
3. `node scripts/generate_embedded.js` ausfuehren, damit der Inline-Fallback
   `data/embedded.js` aktualisiert wird.
4. Erwartungswerte in `tests/testcases.js` neu berechnen.
5. Mind. drei Berechnungen manuell gegen den ESTV-Online-Rechner pruefen
   (Toleranz 2 %).
6. Diese Datei aktualisieren mit neuem Abrufdatum.
