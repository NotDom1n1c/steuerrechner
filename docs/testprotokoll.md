# Testprotokoll – Schweizer Steuerrechner

**Projekt:** Schweizer Steuerrechner (SOL 1) · **Verfasser:** Dominic Aebersold ·
**Klasse:** INFEFZ.1 BS · **Datum der Prüfung:** 2026-06-19

## 1. Automatisierte Tests (Code)

Datei `tests/tests.html` (lädt `tests/testcases.js`) führt **23 Testfälle** im
Browser aus und zeigt eine grüne/rote Liste. Abgedeckt sind:

- Einkommenssteuer Bund + Kanton + Gemeinde + Kirche für AG, BE, BS, ZG, ZH
- Vermögenssteuer (inkl. Freibetrag, Rückwärtskompatibilität bei `vermoegen = 0`)
- Edge-Cases: Einkommen 0, Einkommen 1 Mio, negatives Einkommen/Vermögen
- localStorage-Limit (50 Szenarien), Speichern/Laden-Roundtrip
- Floating-Point-Schutz (Rappen-Arithmetik), Marginal-/Progressionsverhalten

**Ergebnis:** 23 / 23 grün.

## 2. Manuelle Verifikation gegen den offiziellen ESTV-Rechner

**Methode:** Dieselben Parameter (Steuerjahr, Wohnort, Zivilstand, Konfession,
steuerbares Einkommen, Reinvermögen) werden in den eigenen Rechner und in den
offiziellen ESTV-Rechner eingegeben. Die prozentuale Abweichung wird gemessen.

**Hinweis zur Vergleichbarkeit:** Der eigene Rechner wendet den Tarif direkt auf
das eingegebene *steuerbare Einkommen* an. Im ESTV-Rechner wird daher die
Einkommensart **„Steuerbares Einkommen"** gewählt. Das Feld „Steuerbares
Einkommen Bund" bleibt 0; verglichen wird der Teil **Kanton + Gemeinde + Kirche**
(inkl. Vermögenssteuer), da nur dieser von Kanton/Gemeinde abhängt
(der Bund erhebt keine Vermögenssteuer).

**Quelle:** ESTV swisstaxcalculator – Einkommens- und Vermögenssteuer,
<https://swisstaxcalculator.estv.admin.ch/#/calculator/income-wealth-tax>,
Version 1.0.44 · abgerufen am 2026-06-19. Toleranz gemäss Projektauftrag: ≤ 2 %.

| # | Fall | Eingaben | ESTV (Kt+Gde+Kirche) | Eigener Rechner | Abweichung |
|---|------|----------|----------------------|-----------------|-----------|
| 1 | Zug, Einkommen | verheiratet, keine, stb. Eink. 120'000 | 6'633 | 6'632.60 | **0.0 %** |
| 2 | Zug, Einkommen + Vermögen | verheiratet, keine, stb. Eink. 120'000, Reinvermögen 500'000 | 7'045 | 7'044.77 | **0.0 %** |
| 3 | Basel-Stadt, Einkommen + Kirche | ledig, röm.-kath., stb. Eink. 100'000 | 22'680 | 22'680.00 | **0.0 %** |

Alle drei Fälle liegen innerhalb der Toleranz von 2 % (effektiv 0 %).

## 3. Screenshots der Referenzwerte

> Hier die Screenshots der drei ESTV-Resultate einfügen:
>
> - Abbildung 1: ESTV-Resultat Fall 1 (Zug, 120'000)
> - Abbildung 2: ESTV-Resultat Fall 2 (Zug, 120'000 + 500'000 Vermögen)
> - Abbildung 3: ESTV-Resultat Fall 3 (Basel, 100'000, röm.-kath.)

## 4. Weitere manuelle Prüfungen (Definition of Done)

| Prüfung | Status |
|---------|--------|
| `index.html` öffnet ohne Konsolenfehler (F12 → Console „No Issues") | ✅ bestätigt 2026-06-19 |
| `tests/tests.html` im Browser: alle grün (23 / 23) | ✅ bestätigt 2026-06-19 |
| Responsive ohne Layout-Bruch (mobile-first, geprüft ~400 px) | ✅ bestätigt 2026-06-19 |
| Responsive 768 px / 1280 px | ✅ bestätigt (Desktop-Grid) |
| Saved Scenarios überstehen Page-Reload | ✅ bestätigt 2026-06-19 |

## 5. Fazit

Die Berechnungslogik stimmt in allen drei geprüften Fällen auf den Franken genau
mit dem offiziellen ESTV-Rechner überein (Abweichung 0 %, Toleranz ≤ 2 % erfüllt).
Die automatisierten Tests bestätigen zusätzlich die Edge-Cases und die
Fehlerbehandlung. Die Tarifdaten stammen aus den offiziellen ESTV-Grunddaten
(siehe [quellen.md](quellen.md)); es werden keine Platzhalter verwendet.
