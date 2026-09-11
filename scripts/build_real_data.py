# -*- coding: utf-8 -*-
"""
build_real_data.py — Einmalig ausgefuehrt (Python 3 + openpyxl).

Liest die offiziellen ESTV-Grunddaten (Excel) aus docs/sources/ und erzeugt
data/kanton_<x>.json (ZH, BS, ZG, BE, AG) + data/bundessteuer_2026.json mit
ECHTEN Werten.

Quelle: ESTV swisstaxcalculator, Grunddaten "Tarife" + "Steuerfuesse".
Tariff-Logik:
  - Format A "Fuer die naechsten CHF": Stufenbreite (inkrementell)
  - Format B "Steuerbares Einkommen CHF": absolute Schwelle (kumulativ)
  - AG: ein Tarif "Alle" + Splittingfaktor 2 -> Verheiratet via Vollsplitting
    (Schwellen + fix verdoppelt, Satz gleich).
Alle Stufen werden ins Format {bis, fix, satz, ueber} normalisiert, wobei
fix = bis zur Untergrenze 'ueber' aufgelaufene einfache Steuer.
"""

import os
import json
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'docs', 'sources')
OUT = os.path.join(HERE, '..', 'data')

KANTON_NAME = {
    'ZH': 'Zürich', 'BS': 'Basel-Stadt', 'ZG': 'Zug', 'BE': 'Bern', 'AG': 'Aargau'
}

# Gewuenschte Gemeinden pro Kanton (Hauptort + 2)
GEMEINDEN = {
    'ZH': ['Zürich', 'Winterthur', 'Uster'],
    'BS': ['Basel', 'Riehen', 'Bettingen'],
    'ZG': ['Zug', 'Baar', 'Cham'],
    'BE': ['Bern', 'Biel/Bienne', 'Thun'],
    'AG': ['Aarau', 'Baden', 'Wettingen'],
}

SUBJ_LEDIG = 'Alleinstehend ohne Kinder'
SUBJ_VERH = 'Verheiratet / Alleinstehend mit Kindern'
SUBJ_ALLE = 'Alle'


def load_rows(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    return list(ws.iter_rows(values_only=True))


def is_cumulative(rows):
    """Header in Spalte F (Index 5) entscheidet ueber das Format."""
    header = str(rows[3][5] if rows[3][5] else rows[5][5] if len(rows) > 5 else '')
    # Robust: pruefe mehrere moegliche Headerzeilen
    for r in rows[:7]:
        if r and len(r) > 5 and r[5]:
            h = str(r[5])
            if 'Steuerbares' in h:
                return True
            if 'chsten' in h or 'nächst' in h or 'Fuer' in h or 'r die' in h:
                return False
    return False


def splitting_factor(rows):
    for r in rows[:5]:
        if r and r[0] and 'Splitting' in str(r[0]):
            return float(r[2]) if r[2] is not None else 0.0
    return 0.0


def data_rows(rows):
    """Liefert (subjekt, value, percent) fuer alle echten Datenzeilen."""
    out = []
    for r in rows:
        if not r or len(r) < 7:
            continue
        if r[1] in ('ZH', 'BS', 'ZG', 'BE', 'AG', 'Bund') and r[5] is not None and r[6] is not None:
            out.append((r[3], float(r[5]), float(r[6])))
    return out


def build_brackets(pairs, cumulative):
    """pairs: Liste (value, percent) in Reihenfolge. -> Liste {bis,fix,satz,ueber}."""
    out = []
    acc = 0.0
    if cumulative:
        for i, (val, pct) in enumerate(pairs):
            ueber = float(val)
            satz = pct / 100.0
            bis = float(pairs[i + 1][0]) if i + 1 < len(pairs) else None
            out.append({'bis': bis, 'fix': round(acc, 2), 'satz': round(satz, 6), 'ueber': ueber})
            if bis is not None:
                acc += (bis - ueber) * satz
    else:
        cum = 0.0
        for i, (width, pct) in enumerate(pairs):
            w = float(width)
            satz = pct / 100.0
            ueber = cum
            last = (i == len(pairs) - 1) or w >= 1e9
            bis = None if last else cum + w
            out.append({'bis': bis, 'fix': round(acc, 2), 'satz': round(satz, 6), 'ueber': ueber})
            if not last:
                acc += w * satz
                cum += w
    return out


def double_tariff(brackets):
    """Vollsplitting (Faktor 2): tax(E) = 2*tarif(E/2). Schwellen+fix verdoppelt."""
    out = []
    for b in brackets:
        out.append({
            'bis': None if b['bis'] is None else round(b['bis'] * 2, 2),
            'fix': round(b['fix'] * 2, 2),
            'satz': b['satz'],
            'ueber': round(b['ueber'] * 2, 2),
        })
    return out


def classify(subj):
    """Ordnet die Steuersubjekt-Bezeichnung einer Kategorie zu."""
    s = (subj or '').strip()
    if s == SUBJ_ALLE:
        return 'alle'
    if s.startswith('Alleinstehend'):
        return 'ledig'
    if s.startswith('Verheiratet'):
        return 'verheiratet'
    return 'unknown'


def build_tariffs(tarif_path):
    rows = load_rows(tarif_path)
    cum = is_cumulative(rows)
    split = splitting_factor(rows)
    drows = data_rows(rows)

    by_subj = {}
    for subj, val, pct in drows:
        by_subj.setdefault(subj, []).append((val, pct))

    if SUBJ_ALLE in by_subj and split >= 2.0:
        base = build_brackets(by_subj[SUBJ_ALLE], cum)
        return base, double_tariff(base), split
    else:
        ledig = build_brackets(by_subj.get(SUBJ_LEDIG, []), cum)
        verh = build_brackets(by_subj.get(SUBJ_VERH, []), cum)
        return ledig, verh, split


def build_wealth(wealth_path):
    """Vermoegenssteuer-Tarif. Kein Splitting (alle Kantone Faktor 0).
    'Alle' => ledig und verheiratet teilen denselben Tarif."""
    rows = load_rows(wealth_path)
    cum = is_cumulative(rows)
    drows = data_rows(rows)

    groups = {}
    for subj, val, pct in drows:
        groups.setdefault(classify(subj), []).append((val, pct))

    if 'alle' in groups:
        base = build_brackets(groups['alle'], cum)
        return base, base
    ledig = build_brackets(groups.get('ledig', []), cum)
    verh = build_brackets(groups.get('verheiratet', []), cum)
    return ledig, verh


def load_fuss(fuss_path):
    """-> (kantonssteuerfuss, jahr, {gemeinde: {fuss, rk, ev}})"""
    rows = load_rows(fuss_path)
    jahr = int(float(rows[1][0]))
    gem = {}
    kantonfuss = None
    for r in rows:
        if not r or len(r) < 8:
            continue
        if r[1] in ('ZH', 'BS', 'ZG', 'BE', 'AG') and r[3] and r[4] is not None:
            name = str(r[3])
            kantonfuss = float(r[4])
            gem[name] = {
                'fuss': float(r[5]) if r[5] is not None else 0.0,
                'ev': float(r[6]) if r[6] is not None else 0.0,   # Kirche ref. = evangelisch-reformiert
                'rk': float(r[7]) if r[7] is not None else 0.0,   # Kirche roem.-kt.
            }
    return kantonfuss, jahr, gem


def num(x):
    """Ganzzahlen ohne .0 ausgeben."""
    if x is None:
        return None
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


def clean_brackets(brs):
    out = []
    for b in brs:
        out.append({
            'bis': num(b['bis']),
            'fix': num(b['fix']),
            'satz': b['satz'],
            'ueber': num(b['ueber']),
        })
    return out


def build_canton(code, tarif_file, fuss_file, wealth_file):
    tarif_path = os.path.join(SRC, tarif_file)
    fuss_path = os.path.join(SRC, fuss_file)
    wealth_path = os.path.join(SRC, wealth_file)
    ledig, verh, split = build_tariffs(tarif_path)
    v_ledig, v_verh = build_wealth(wealth_path)
    kantonfuss, jahr, all_gem = load_fuss(fuss_path)

    gemeinden = {}
    for name in GEMEINDEN[code]:
        if name not in all_gem:
            raise SystemExit('Gemeinde fehlt in %s: %s' % (fuss_file, name))
        g = all_gem[name]
        gemeinden[name] = {
            'fuss': num(g['fuss']),
            'rk': num(g['rk']),
            'ev': num(g['ev']),
        }

    obj = {
        'kanton': code,
        'kanton_name': KANTON_NAME[code],
        'jahr': jahr,
        'quelle': 'ESTV swisstaxcalculator – Grunddaten Tarife + Steuerfuesse (Einkommen)',
        'abgerufen': '2026-06-08',
        'kantonssteuerfuss': num(kantonfuss),
        'splittingfaktor': num(split),
        'gemeinden': gemeinden,
        'tarif_ledig': clean_brackets(ledig),
        'tarif_verheiratet': clean_brackets(verh),
        'tarif_vermoegen_ledig': clean_brackets(v_ledig),
        'tarif_vermoegen_verheiratet': clean_brackets(v_verh),
    }
    path = os.path.join(OUT, 'kanton_%s.json' % code.lower())
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('OK %s -> %s (Jahr %s, KantonFuss %s, Split %s, Stufen L/V %d/%d)' % (
        code, os.path.basename(path), jahr, num(kantonfuss), num(split), len(ledig), len(verh)))


def build_bund(tarif_file):
    rows = load_rows(os.path.join(SRC, tarif_file))
    jahr = int(float(rows[1][0]))
    cum = is_cumulative(rows)
    drows = data_rows(rows)
    by_subj = {}
    for subj, val, pct in drows:
        by_subj.setdefault(subj, []).append((val, pct))
    ledig = build_brackets(by_subj.get(SUBJ_LEDIG, []), cum)
    verh = build_brackets(by_subj.get(SUBJ_VERH, []), cum)
    obj = {
        'jahr': jahr,
        'waehrung': 'CHF',
        'quelle': 'ESTV – direkte Bundessteuer (DBG Art. 36), Grunddaten Tarife',
        'abgerufen': '2026-06-08',
        'tarif_ledig': clean_brackets(ledig),
        'tarif_verheiratet': clean_brackets(verh),
    }
    path = os.path.join(OUT, 'bundessteuer_2026.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print('OK Bund -> %s (Jahr %s, Stufen L/V %d/%d)' % (os.path.basename(path), jahr, len(ledig), len(verh)))


if __name__ == '__main__':
    build_canton('ZH', 'tarif_zh_2026.xlsx', 'fuss_zh_2026.xlsx', 'vermoegen_zh_2026.xlsx')
    build_canton('BS', 'tarif_bs_2026.xlsx', 'fuss_bs_2026.xlsx', 'vermoegen_bs_2026.xlsx')
    build_canton('ZG', 'tarif_zg_2026.xlsx', 'fuss_zg_2026.xlsx', 'vermoegen_zg_2026.xlsx')
    build_canton('BE', 'tarif_be_2025.xlsx', 'fuss_be_2025.xlsx', 'vermoegen_be_2025.xlsx')
    build_canton('AG', 'tarif_ag_2025.xlsx', 'fuss_ag_2025.xlsx', 'vermoegen_ag_2025.xlsx')
    build_bund('tarif_bund_2025.xlsx')
    print('\nFertig.')
