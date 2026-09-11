// testcases.js - Browser-Test-Runner
// Erwartete Werte fuer ZH/BS/ZG/BE/AG + Bund stammen aus echten ESTV-Grunddaten
// (Tarife + Steuerfuesse, Stand 2025/2026) und dienen als Regressions-Baseline.
// Bei Aktualisierung der Tarife muessen die expected-Werte neu berechnet werden
// (node scripts/build_real_data.py erneut ausfuehren, dann Werte hier anpassen).
// Toleranz fuer Steuerwerte: 2 % oder min. CHF 1.

(function () {
  'use strict';

  const TOL_PCT = 0.02;
  const TOL_ABS = 1.00; // CHF

  function approxEqual(a, b, tol) {
    if (typeof tol === 'number') {
      return Math.abs(a - b) <= tol;
    }
    const diff = Math.abs(a - b);
    return diff <= TOL_ABS || diff <= Math.abs(b) * TOL_PCT;
  }

  // --- Daten laden -------------------------------------------------------

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('Konnte ' + path + ' nicht laden.');
      return r.json();
    });
  }

  function loadAll() {
    // Falls embedded.js Daten gesetzt hat, nutzen wir die direkt (file://-Support).
    if (window.STEUER_DATA && window.STEUER_DATA.bund) {
      const out = { bund: window.STEUER_DATA.bund };
      Object.assign(out, window.STEUER_DATA.kantone);
      return Promise.resolve(out);
    }
    const promises = [loadJson('../data/bundessteuer_2026.json')];
    SteuerValidate.KANTONE.forEach(function (k) {
      promises.push(loadJson('../data/kanton_' + k.toLowerCase() + '.json'));
    });
    return Promise.all(promises).then(function (arr) {
      const out = { bund: arr[0] };
      SteuerValidate.KANTONE.forEach(function (k, i) { out[k] = arr[i + 1]; });
      return out;
    });
  }

  // --- Test-Definition ---------------------------------------------------

  function defineTests(data) {
    const all = data;
    const HAUPTORTE = { BS: 'Basel', ZH: 'Zürich', ZG: 'Zug', BE: 'Bern', AG: 'Aarau' };
    const tests = [];

    function add(name, fn) { tests.push({ name: name, fn: fn }); }

    // Werte aus echten ESTV-Grunddaten (Tarife + Steuerfuesse). Regressions-Baseline,
    // gegen ESTV-Online-Rechner gegengeprueft (Toleranz <= 2 %).

    // Test 1
    add('Ledig 50k ZH/Zürich keine: Total ~ 4727.92', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 50000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        all.bund, all.ZH);
      assert(approxEqual(r.bund, 400.84), 'Bund: ' + r.bund);
      assert(approxEqual(r.einfache_steuer, 2022.00), 'Einfache: ' + r.einfache_steuer);
      assert(approxEqual(r.gemeindesteuer, 2406.18), 'Gemeinde: ' + r.gemeindesteuer);
      assert(approxEqual(r.total, 4727.92), 'Total: ' + r.total);
    });

    // Test 2
    add('Ledig 100k BS/Basel rk: Total ~ 25368.07', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 100000, zivilstand: 'ledig', konfession: 'rk', kanton: 'BS', gemeinde: 'Basel' },
        all.bund, all.BS);
      assert(approxEqual(r.bund, 2688.07), 'Bund: ' + r.bund);
      assert(approxEqual(r.einfache_steuer, 21000.00), 'Einfache: ' + r.einfache_steuer);
      assert(approxEqual(r.kirchensteuer, 1680.00), 'Kirche: ' + r.kirchensteuer);
      assert(approxEqual(r.total, 25368.07), 'Total: ' + r.total);
    });

    // Test 3
    add('Verheiratet 120k ZG/Zug keine: Total ~ 9562.60', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 120000, zivilstand: 'verheiratet', konfession: 'keine', kanton: 'ZG', gemeinde: 'Zug' },
        all.bund, all.ZG);
      assert(approxEqual(r.bund, 2930.00), 'Bund: ' + r.bund);
      assert(approxEqual(r.einfache_steuer, 5102.00), 'Einfache: ' + r.einfache_steuer);
      assert(approxEqual(r.total, 9562.60), 'Total: ' + r.total);
    });

    // Test 4
    add('Verheiratet 150k BE/Bern ev: Total ~ 35630.16', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 150000, zivilstand: 'verheiratet', konfession: 'ev', kanton: 'BE', gemeinde: 'Bern' },
        all.bund, all.BE);
      assert(approxEqual(r.bund, 5413.00), 'Bund: ' + r.bund);
      assert(approxEqual(r.einfache_steuer, 6430.55), 'Einfache: ' + r.einfache_steuer);
      assert(approxEqual(r.kantonssteuer, 19130.89), 'Kanton: ' + r.kantonssteuer);
      assert(approxEqual(r.gemeindesteuer, 9903.05), 'Gemeinde: ' + r.gemeindesteuer);
      assert(approxEqual(r.kirchensteuer, 1183.22), 'Kirche: ' + r.kirchensteuer);
      assert(approxEqual(r.total, 35630.16), 'Total: ' + r.total);
    });

    // Test 5 - AG nutzt Vollsplitting (Faktor 2); hier ledig zum Vergleich
    add('Ledig 90k AG/Aarau keine: Total ~ 14423.23', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 90000, zivilstand: 'ledig', konfession: 'keine', kanton: 'AG', gemeinde: 'Aarau' },
        all.bund, all.AG);
      assert(approxEqual(r.bund, 2028.07), 'Bund: ' + r.bund);
      assert(approxEqual(r.einfache_steuer, 5988.00), 'Einfache: ' + r.einfache_steuer);
      assert(approxEqual(r.kantonssteuer, 6646.68), 'Kanton: ' + r.kantonssteuer);
      assert(approxEqual(r.gemeindesteuer, 5748.48), 'Gemeinde: ' + r.gemeindesteuer);
      assert(approxEqual(r.total, 14423.23), 'Total: ' + r.total);
    });

    // Test 6 - Edge: Einkommen 0
    add('Edge: Einkommen 0 -> alle Steuern 0', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 0, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        all.bund, all.ZH);
      assert(r.bund === 0, 'Bund: ' + r.bund);
      assert(r.kantonssteuer === 0, 'Kanton: ' + r.kantonssteuer);
      assert(r.total === 0, 'Total: ' + r.total);
    });

    // Test 7 - Edge: 1 Mio
    add('Edge: 1 Mio CHF Ledig ZH liefert plausibles Top-Tarif-Resultat', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 1000000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        all.bund, all.ZH);
      // Bund Maximaltarif 11.5 % -> ca. 115'000
      assert(approxEqual(r.bund, 115001.47), 'Bund: ' + r.bund);
      // ZH einfache: 24655 + (1000000-266700)*0.13 = 119984
      assert(approxEqual(r.einfache_steuer, 119984.00), 'Einfache: ' + r.einfache_steuer);
      // Total plausibel
      assert(r.total > 300000 && r.total < 450000, 'Total ausserhalb plausibler Bandbreite: ' + r.total);
    });

    // Test 8 - Vergleich ZH vs ZG
    add('Vergleich: 75k Ledig - ZG hat tiefere Steuer als ZH', function () {
      const inp = { einkommen: 75000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      const v = SteuerCalc.calcVergleich(inp, all.bund, { ZH: all.ZH, ZG: all.ZG, BS: all.BS, BE: all.BE, AG: all.AG }, HAUPTORTE);
      const zh = v.find(function (x) { return x.kanton === 'ZH'; });
      const zg = v.find(function (x) { return x.kanton === 'ZG'; });
      assert(zg.total < zh.total, 'ZG (' + zg.total + ') sollte < ZH (' + zh.total + ') sein');
    });

    // Test 9 - localStorage Limit
    add('localStorage: 50 Szenarien speichern, 51. wird abgelehnt', function () {
      SteuerStorage.clearAll();
      const inp = { einkommen: 50000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      for (let i = 1; i <= 50; i++) {
        const r = SteuerStorage.saveScenario('test_' + i, inp);
        assert(r.ok, 'Speichern Nr ' + i + ' sollte ok sein');
      }
      const r51 = SteuerStorage.saveScenario('test_51', inp);
      assert(!r51.ok, '51. sollte abgelehnt werden');
      assert(/Limit/.test(r51.error || ''), 'Fehlermeldung sollte "Limit" enthalten: ' + r51.error);
      SteuerStorage.clearAll();
    });

    // Test 10 - Validierung
    add('Validierung: Einkommen -1000 -> Fehler', function () {
      const v = SteuerValidate.validateInput(
        { einkommen: -1000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        ['Zürich']
      );
      assert(!v.valid, 'Ergebnis sollte invalid sein');
      assert(v.errors.length >= 1, 'Mindestens ein Fehler erwartet');
      assert(v.errors.some(function (e) { return /negativ/.test(e); }), 'Fehler erwaehnt nicht "negativ": ' + v.errors.join(' | '));
    });

    // Test 11 - Floating Point: 0.1 + 0.2 Problem darf nicht durchschlagen
    add('Rappen-Arithmetik vermeidet Floating-Point-Drift', function () {
      // Zwei Stufen, die exakt zu CHF .03 fuehren sollten, statt .029999...
      const r = SteuerCalc.applyFuss(0.10 + 0.20, 100); // Eingabe-Wert testen
      // CHF 0.30 * 100 % = 0.30
      assert(Math.abs(r - 0.30) < 0.005, 'Erwartet 0.30, erhalten ' + r);
    });

    // Test 12 - Kirchensteuer 0 wenn Konfession "keine"
    add('Kirchensteuer ist 0 fuer Konfession "keine"', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 80000, zivilstand: 'ledig', konfession: 'keine', kanton: 'BE', gemeinde: 'Bern' },
        all.bund, all.BE);
      assert(r.kirchensteuer === 0, 'Kirche sollte 0 sein, war ' + r.kirchensteuer);
    });

    // Test 13 - Zivilstand: verheiratet < ledig bei gleichem Einkommen (Splitting/hoehere Schwellen)
    add('Verheiratet zahlt bei 80k weniger als Ledig (gleicher Kanton)', function () {
      const inpL = { einkommen: 80000, zivilstand: 'ledig',        konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      const inpV = { einkommen: 80000, zivilstand: 'verheiratet',  konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      const a = SteuerCalc.calcGesamt(inpL, all.bund, all.ZH);
      const b = SteuerCalc.calcGesamt(inpV, all.bund, all.ZH);
      assert(b.total < a.total, 'Verheiratet (' + b.total + ') sollte < Ledig (' + a.total + ') sein');
    });

    // Test 14 - Storage roundtrip
    add('Storage: speichern -> laden -> identisch', function () {
      SteuerStorage.clearAll();
      const inp = { einkommen: 95000, zivilstand: 'verheiratet', konfession: 'rk', kanton: 'AG', gemeinde: 'Baden' };
      const s = SteuerStorage.saveScenario('rt_test', inp);
      assert(s.ok, 'save ok');
      const l = SteuerStorage.loadScenario('rt_test');
      assert(l.ok, 'load ok');
      assert(l.data.einkommen === 95000, 'Einkommen erhalten');
      assert(l.data.kanton === 'AG', 'Kanton erhalten');
      assert(l.data.gemeinde === 'Baden', 'Gemeinde erhalten');
      SteuerStorage.deleteScenario('rt_test');
    });

    // Test 15 - Alle unterstuetzten Kantone liefern plausible Resultate
    add('Alle 5 Kantone liefern plausible Resultate fuer 80k Ledig', function () {
      const inp = { einkommen: 80000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      SteuerValidate.KANTONE.forEach(function (k) {
        assert(all[k], 'Kanton ' + k + ' fehlt');
        const data = all[k];
        const gemeinde = Object.keys(data.gemeinden)[0];
        const r = SteuerCalc.calcGesamt(
          Object.assign({}, inp, { kanton: k, gemeinde: gemeinde }),
          all.bund, data
        );
        assert(r.total > 0 && r.total < 80000, 'Kanton ' + k + ' Total unrealistisch: ' + r.total);
      });
    });

    // Test 16 - 3a Vorteil ist positiv und sinkt nicht das Einkommen
    add('3a Einzahlung von 7258 CHF reduziert Steuern (Vorteil > 0)', function () {
      const inp = { einkommen: 100000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      const v = SteuerCalc.calc3aVorteil(inp, all.bund, all.ZH, 7258);
      assert(v > 0, '3a-Vorteil sollte positiv sein, war ' + v);
      assert(v < 7258, '3a-Vorteil sollte kleiner als Einzahlung sein, war ' + v);
    });

    // Test 17 - Marginalsatz steigt mit Einkommen (Progression)
    add('Marginalsatz steigt mit Einkommen (Progression)', function () {
      const base = { zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' };
      const m1 = SteuerCalc.calcMarginalsatz(Object.assign({}, base, { einkommen: 50000 }), all.bund, all.ZH);
      const m2 = SteuerCalc.calcMarginalsatz(Object.assign({}, base, { einkommen: 200000 }), all.bund, all.ZH);
      assert(m2 > m1, 'Marginalsatz bei 200k (' + m2 + ') sollte > bei 50k (' + m1 + ') sein');
    });

    // Test 18 - Reverse Search liefert plausibles Brutto
    add('Reverse Search: 5000 Netto/Monat in ZG -> Brutto plausibel', function () {
      const brutto = SteuerCalc.reverseSearch(5000, all.bund, all.ZG, 'ledig', 'Zug', 'keine');
      assert(brutto > 60000 && brutto < 80000,
        'Brutto fuer 5000 Netto/Monat in ZG sollte zwischen 60k-80k sein, war ' + brutto);
    });

    // Test 19 - Trace liefert nicht-leeres Array fuer positives Einkommen
    add('Berechnungsweg-Trace liefert nicht-leeres Array', function () {
      const t = SteuerCalc.traceBundessteuer(all.bund, 100000, 'ledig');
      assert(Array.isArray(t) && t.length > 2, 'Trace zu kurz oder kein Array');
    });

    // Test 20 - Vermoegenssteuer: 0 Vermoegen aendert nichts (Rueckwaertskompatibilitaet)
    add('Vermoegen 0: Total identisch wie ohne Vermoegen', function () {
      const ohne = SteuerCalc.calcGesamt(
        { einkommen: 100000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        all.bund, all.ZH);
      const mitNull = SteuerCalc.calcGesamt(
        { einkommen: 100000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich', vermoegen: 0 },
        all.bund, all.ZH);
      assert(ohne.total === mitNull.total, 'Total weicht ab: ' + ohne.total + ' vs ' + mitNull.total);
      assert(mitNull.vermoegenssteuer === 0, 'Vermoegenssteuer sollte 0 sein');
    });

    // Test 21 - Vermoegenssteuer ZH 500k: plausibler Wert, Total steigt
    add('Vermoegenssteuer ZH ledig 500k ~ 638.80', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 100000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich', vermoegen: 500000 },
        all.bund, all.ZH);
      assert(approxEqual(r.einfache_vermoegen, 298.50), 'einfache Vermoegen: ' + r.einfache_vermoegen);
      assert(approxEqual(r.vermoegenssteuer, 638.80), 'Vermoegenssteuer: ' + r.vermoegenssteuer);
      assert(r.total > r.einkommenssteuer_total, 'Total muss > reine Einkommenssteuer sein');
    });

    // Test 22 - Vermoegens-Freibetrag ZH (81'000): darunter keine Steuer
    add('Vermoegen unter Freibetrag (ZH 50k < 81k) -> 0', function () {
      const r = SteuerCalc.calcGesamt(
        { einkommen: 80000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich', vermoegen: 50000 },
        all.bund, all.ZH);
      assert(r.vermoegenssteuer === 0, 'Vermoegenssteuer sollte 0 sein, war ' + r.vermoegenssteuer);
    });

    // Test 23 - Validierung: negatives Vermoegen -> Fehler
    add('Validierung: Nettovermoegen -5000 -> Fehler', function () {
      const v = SteuerValidate.validateInput(
        { einkommen: 80000, vermoegen: -5000, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: 'Zürich' },
        ['Zürich']);
      assert(!v.valid, 'sollte invalid sein');
      assert(v.errors.some(function (e) { return /vermoegen/i.test(e); }), 'Fehler erwaehnt Vermoegen nicht');
    });

    return tests;
  }

  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'Assertion failed');
  }

  // --- Runner -------------------------------------------------------------

  function runAll() {
    const root = document.getElementById('results');
    const summary = document.getElementById('summary');
    root.innerHTML = '';
    summary.textContent = 'Lade Daten...';

    loadAll().then(function (data) {
      const tests = defineTests(data);
      let pass = 0, fail = 0;
      const start = performance.now();

      tests.forEach(function (t, i) {
        const li = document.createElement('li');
        try {
          t.fn();
          li.className = 'pass';
          li.textContent = (i + 1) + '. PASS - ' + t.name;
          pass++;
        } catch (e) {
          li.className = 'fail';
          li.textContent = (i + 1) + '. FAIL - ' + t.name + '  >>  ' + (e.message || e);
          fail++;
        }
        root.appendChild(li);
      });

      const ms = (performance.now() - start).toFixed(0);
      summary.textContent = pass + ' / ' + tests.length + ' Tests bestanden (' + ms + ' ms)';
      summary.className = fail === 0 ? 'all-pass' : 'has-fail';
    }).catch(function (e) {
      summary.textContent = 'Fehler beim Laden: ' + e.message + ' (Tipp: Tests ueber http(s):// oeffnen, file:// blockiert fetch.)';
      summary.className = 'has-fail';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('btn-run').addEventListener('click', runAll);
    runAll();
  });
})();
