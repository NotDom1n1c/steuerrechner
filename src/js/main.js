// main.js - UI-Glue. Steuerlogik selbst lebt in calc.js.

(function () {
  'use strict';

  const KANTONE = SteuerValidate.KANTONE;

  // Anzeige-Namen der unterstuetzten Kantone.
  const KANTON_NAMEN = {
    AG: 'Aargau', BE: 'Bern', BS: 'Basel-Stadt', ZG: 'Zug', ZH: 'Zürich'
  };

  const state = {
    bundData: null,
    kantone: {},        // { ZH: data, ... }
    hauptorte: {},      // erster Gemeinde-Key pro Kanton
    lastResults: null,
    debounceTimer: null
  };

  // --- Datei-Loader (mit Fallback auf embedded.js) -----------------------

  function loadJson(path) {
    return fetch(path).then(function (r) {
      if (!r.ok) throw new Error('Konnte ' + path + ' nicht laden (' + r.status + ').');
      return r.json();
    });
  }

  function loadAllData() {
    // Wenn embedded.js bereits Daten gesetzt hat, bevorzugt nutzen (file:// support).
    if (window.STEUER_DATA && window.STEUER_DATA.bund && window.STEUER_DATA.kantone) {
      state.bundData = window.STEUER_DATA.bund;
      Object.keys(window.STEUER_DATA.kantone).forEach(function (k) {
        state.kantone[k] = window.STEUER_DATA.kantone[k];
      });
      computeHauptorte();
      return Promise.resolve();
    }
    const promises = [
      loadJson('data/bundessteuer_2026.json').then(function (d) { state.bundData = d; })
    ];
    KANTONE.forEach(function (kt) {
      promises.push(
        loadJson('data/kanton_' + kt.toLowerCase() + '.json')
          .then(function (d) { state.kantone[kt] = d; })
      );
    });
    return Promise.all(promises).then(computeHauptorte);
  }

  function computeHauptorte() {
    KANTONE.forEach(function (kt) {
      const d = state.kantone[kt];
      if (d && d.gemeinden) state.hauptorte[kt] = Object.keys(d.gemeinden)[0];
    });
  }

  // --- Formatierung ------------------------------------------------------

  function fmtChf(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
    return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtPct(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return '-';
    return (n * 100).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
  }
  function fmtIntCHF(n) {
    return n.toLocaleString('de-CH', { maximumFractionDigits: 0 });
  }
  // Apostroph als Tausender (CH): 80'000
  function fmtIntApostrophe(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '';
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }
  function parseEinkommenInput(s) {
    if (typeof s !== 'string') return Number(s);
    const cleaned = s.replace(/[^\d.-]/g, '');
    return cleaned === '' ? NaN : Number(cleaned);
  }

  // --- Kantons-Dropdown initial befuellen --------------------------------

  function fillKantonDropdown() {
    const ktSel = document.getElementById('kanton');
    if (!ktSel) return;
    const arr = KANTONE.slice().sort(function (a, b) {
      return KANTON_NAMEN[a].localeCompare(KANTON_NAMEN[b], 'de');
    });
    ktSel.innerHTML = '';
    arr.forEach(function (k) {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = KANTON_NAMEN[k] + ' (' + k + ')';
      ktSel.appendChild(opt);
    });
    ktSel.value = 'ZH';
  }

  // --- Banner / Fehler ---------------------------------------------------

  function showPlatzhalterBannerIfNeeded() {
    const banner = document.getElementById('platzhalter-banner');
    if (!banner) return;
    const anyPh = (state.bundData && state.bundData._PLATZHALTER) ||
      KANTONE.some(function (k) { return state.kantone[k] && state.kantone[k]._PLATZHALTER; });
    if (anyPh) {
      banner.textContent = '⚠ Es sind Platzhalter-Tarife geladen – vor produktivem Einsatz durch offizielle ESTV-Werte ersetzen.';
    }
    banner.hidden = !anyPh;
  }
  function showError(msg) {
    const el = document.getElementById('fehler');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false; el.textContent = msg;
  }

  // --- Gemeinde-Dropdown -------------------------------------------------

  function refreshGemeinden() {
    const ktSel = document.getElementById('kanton');
    const gmSel = document.getElementById('gemeinde');
    if (!ktSel || !gmSel) return;
    const data = state.kantone[ktSel.value];
    gmSel.innerHTML = '';
    if (!data) return;
    Object.keys(data.gemeinden).forEach(function (g) {
      const opt = document.createElement('option');
      opt.value = g;
      const entry = data.gemeinden[g];
      const fuss = (typeof entry === 'object' && entry !== null) ? entry.fuss : entry;
      opt.textContent = g + ' (Steuerfuss ' + fuss + ')';
      gmSel.appendChild(opt);
    });
  }

  // --- Eingabe lesen / setzen --------------------------------------------

  function readInput() {
    return {
      einkommen: Number(document.getElementById('einkommen').value),
      vermoegen: Number(document.getElementById('vermoegen').value) || 0,
      zivilstand: document.getElementById('zivilstand').value,
      konfession: document.getElementById('konfession').value,
      kanton: document.getElementById('kanton').value,
      gemeinde: document.getElementById('gemeinde').value
    };
  }
  function setInput(input) {
    document.getElementById('einkommen').value = input.einkommen;
    document.getElementById('einkommen-display').value = fmtIntApostrophe(input.einkommen);
    document.getElementById('vermoegen').value = input.vermoegen || 0;
    document.getElementById('zivilstand').value = input.zivilstand;
    document.getElementById('konfession').value = input.konfession;
    document.getElementById('kanton').value = input.kanton;
    refreshGemeinden();
    if (input.gemeinde) document.getElementById('gemeinde').value = input.gemeinde;
  }

  function read3a() { return Number(document.getElementById('saeule3a').value) || 0; }

  // --- Berechnung anstossen ----------------------------------------------

  function debouncedRechnen() {
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(rechnen, 200);
  }

  function rechnen() {
    showError(null);
    const input = readInput();
    const ktData = state.kantone[input.kanton];
    const gemeinden = ktData ? Object.keys(ktData.gemeinden) : null;
    const v = SteuerValidate.validateInput(input, gemeinden);
    if (!v.valid) { showError(v.errors.join(' ')); return; }

    // 3a Einzahlung wirkt wie ein Abzug vom steuerbaren Einkommen
    const dreiA = read3a();
    const inputEffektiv = Object.assign({}, input, { einkommen: Math.max(0, input.einkommen - dreiA) });

    let einzeln, vergleich;
    try {
      einzeln = SteuerCalc.calcGesamt(inputEffektiv, state.bundData, ktData);
      vergleich = SteuerCalc.calcVergleich(inputEffektiv, state.bundData, state.kantone, state.hauptorte);
    } catch (e) {
      showError('Berechnungsfehler: ' + (e.message || e));
      return;
    }

    state.lastResults = { input: input, inputEffektiv: inputEffektiv, einzeln: einzeln, vergleich: vergleich };

    renderEinzelresultat(einzeln, input, inputEffektiv, dreiA);
    renderVergleichTabelle(vergleich, input.kanton, einzeln.total);
    renderChart(vergleich);
    renderProgression(input, ktData);
    render3aVorteil(input, ktData, dreiA);
    renderTrace(input, inputEffektiv, ktData);
    onReverseSearch(); // Rueckwaerts-Rechnung haengt an Zivilstand/Konfession, darum mitlaufen lassen
    syncUrl(input, dreiA);
  }

  // --- Render: Einzelresultat -------------------------------------------

  function renderEinzelresultat(r, input, inputEffektiv, dreiA) {
    const tb = document.getElementById('einzel-result');
    if (!tb) return;
    const netto = input.einkommen - r.total;
    const marg = SteuerCalc.calcMarginalsatz(inputEffektiv, state.bundData, state.kantone[input.kanton]);

    renderSummary(r, input, marg);

    let html = '';
    html += row('Bruttoeinkommen', 'CHF ' + fmtChf(input.einkommen));
    if (dreiA > 0) {
      html += row('- Säule 3a Einzahlung', '- CHF ' + fmtChf(dreiA));
      html += row('Steuerbares Einkommen', 'CHF ' + fmtChf(inputEffektiv.einkommen));
    }
    html += row('Bundessteuer', 'CHF ' + fmtChf(r.bund));
    html += row('Einfache Steuer (Kanton)', 'CHF ' + fmtChf(r.einfache_steuer));
    html += row('Kantonssteuer', 'CHF ' + fmtChf(r.kantonssteuer));
    html += row('Gemeindesteuer ' + r.gemeinde, 'CHF ' + fmtChf(r.gemeindesteuer));
    html += row('Kirchensteuer', 'CHF ' + fmtChf(r.kirchensteuer));
    if (input.vermoegen > 0) {
      html += '<tr class="row-sub"><th>Einkommenssteuer (Total)</th><td>CHF ' + fmtChf(r.einkommenssteuer_total) + '</td></tr>';
      html += row('Nettovermögen', 'CHF ' + fmtChf(input.vermoegen));
      html += row('Einfache Vermögenssteuer', 'CHF ' + fmtChf(r.einfache_vermoegen));
      html += row('Vermögenssteuer (Kanton + Gemeinde + Kirche)', 'CHF ' + fmtChf(r.vermoegenssteuer));
    }
    html += '<tr class="row-total"><th>Total Steuer</th><td>CHF ' + fmtChf(r.total) + '</td></tr>';
    html += row('Durchschnittssatz (Total / Brutto)', fmtPct(r.total / Math.max(1, input.einkommen)));
    html += row('Grenzsteuersatz (nächste 100 CHF)', fmtPct(marg));
    html += row('Netto pro Jahr', 'CHF ' + fmtChf(netto));
    html += row('Netto pro Monat', 'CHF ' + fmtChf(netto / 12));
    tb.innerHTML = html;
  }

  // --- Render: Kennzahlen + "Wohin geht dein Lohn" -----------------------

  // Zahl weich hochzaehlen statt springen (respektiert reduced motion)
  const _tweens = {};
  function tweenNumber(id, to, fmt) {
    const el = document.getElementById(id);
    if (!el) return;
    const from = _tweens[id] ? _tweens[id].value : 0;
    if (_tweens[id]) cancelAnimationFrame(_tweens[id].raf);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(from)) { el.textContent = fmt(to); _tweens[id] = { value: to }; return; }
    const t0 = performance.now(), dur = 550;
    const state = { value: from, raf: 0 };
    _tweens[id] = state;
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      state.value = from + (to - from) * e;
      el.textContent = fmt(state.value);
      if (t < 1) state.raf = requestAnimationFrame(step);
    })(t0);
  }

  function renderSummary(r, input, marg) {
    const brutto = Math.max(0, input.einkommen);
    const netto = brutto - r.total;
    tweenNumber('kpi-netto', netto / 12, function (v) { return fmtIntApostrophe(v); });
    tweenNumber('kpi-total', r.total, function (v) { return 'CHF ' + fmtIntApostrophe(v); });
    tweenNumber('kpi-avg', r.total / Math.max(1, brutto), fmtPct);
    tweenNumber('kpi-marg', marg, fmtPct);

    const ctx = document.getElementById('kpi-context');
    if (ctx) {
      ctx.textContent = '· ' + r.gemeinde + ' ' + input.kanton + ' · ' +
        (input.zivilstand === 'verheiratet' ? 'verheiratet' : 'ledig');
    }

    // Aufteilung des Bruttoeinkommens in Steuerarten + Netto
    const parts = [
      { key: 'bund', label: 'Bund', value: r.bund, dark: true },
      { key: 'kanton', label: 'Kanton', value: r.kantonssteuer, dark: true },
      { key: 'gemeinde', label: 'Gemeinde', value: r.gemeindesteuer },
      { key: 'kirche', label: 'Kirche', value: r.kirchensteuer },
      { key: 'vermoegen', label: 'Vermögen', value: r.vermoegenssteuer || 0, dark: true }
    ].filter(function (p) { return p.value > 0.5; });
    const bar = document.getElementById('split-bar');
    const legend = document.getElementById('split-legend');
    if (!bar || !legend) return;
    const base = Math.max(1, brutto, r.total);
    let barHtml = '', legHtml = '';
    parts.forEach(function (p) {
      const pct = p.value / base * 100;
      barHtml += '<span class="' + (p.dark ? 'on-dark' : 'on-light') + '" style="flex-grow:' + pct.toFixed(3) +
        ';background:var(--s-' + p.key + ')" title="' + p.label + ': CHF ' + fmtChf(p.value) + '">' +
        (pct >= 4 ? pct.toFixed(1) + '%' : '') + '</span>';
      legHtml += '<li><i style="background:var(--s-' + p.key + ')"></i>' + p.label + ' <b>' + fmtIntApostrophe(p.value) + '</b></li>';
    });
    const nettoPct = Math.max(0, netto) / base * 100;
    barHtml += '<span class="on-light" style="flex-grow:' + nettoPct.toFixed(3) + ';background:var(--s-netto)" title="Netto: CHF ' +
      fmtChf(netto) + '">' + (nettoPct >= 8 ? 'Netto ' + nettoPct.toFixed(1) + '%' : '') + '</span>';
    legHtml += '<li class="muted-li"><i style="background:var(--s-netto);outline:1px solid var(--line)"></i>Bleibt dir <b>' + fmtIntApostrophe(netto) + '</b></li>';
    bar.innerHTML = barHtml;
    legend.innerHTML = legHtml;

    const h = document.getElementById('split-hundert');
    if (h) h.textContent = '100 Franken';
    const steuernPro100 = r.total / Math.max(1, brutto) * 100;
    bar.setAttribute('aria-label', 'Von 100 Franken Lohn gehen ' + steuernPro100.toFixed(2) + ' Franken an Steuern.');
  }

  function row(label, value) {
    return '<tr><th>' + label + '</th><td>' + value + '</td></tr>';
  }

  // --- Render: Vergleichstabelle (mit Umzug-Differenz) -------------------

  function renderVergleichTabelle(results, currentKanton, currentTotal) {
    const tb = document.getElementById('vergleich-body');
    if (!tb) return;
    tb.innerHTML = '';
    results.forEach(function (r) {
      const tr = document.createElement('tr');
      if (r.kanton === currentKanton) tr.className = 'highlight';
      const diff = r.total - currentTotal;
      const diffStr = (diff === 0) ? '-' :
        (diff < 0 ? '<span class="diff-minus">' : '<span class="diff-plus">') +
        (diff > 0 ? '+' : '') + fmtChf(diff) + '</span>';
      tr.innerHTML =
        '<td>' + r.kanton + '</td>' +
        '<td>' + r.gemeinde + '</td>' +
        '<td>' + fmtChf(r.bund) + '</td>' +
        '<td>' + fmtChf(r.kantonssteuer) + '</td>' +
        '<td>' + fmtChf(r.gemeindesteuer) + '</td>' +
        '<td>' + fmtChf(r.kirchensteuer) + '</td>' +
        '<td>' + fmtChf(r.vermoegenssteuer || 0) + '</td>' +
        '<td><strong>' + fmtChf(r.total) + '</strong></td>' +
        '<td>' + diffStr + '</td>';
      tb.appendChild(tr);
    });
  }

  function renderChart(results) {
    const cv = document.getElementById('chart-canvas');
    if (cv) SteuerChart.renderBarChart(cv, results);
  }

  // --- Render: Progressionskurve -----------------------------------------

  function renderProgression(input, ktData) {
    const cv = document.getElementById('progression-canvas');
    if (!cv || !ktData) return;
    const points = [];
    for (let e = 0; e <= 500000; e += 5000) {
      const inp = Object.assign({}, input, { einkommen: e });
      try {
        const r = SteuerCalc.calcGesamt(inp, state.bundData, ktData);
        points.push({ einkommen: e, satz: e > 0 ? r.total / e : 0 });
      } catch (err) { /* ignore */ }
    }
    SteuerChart.renderProgressionChart(cv, points, input.einkommen);
  }

  // --- Render: 3a Vorteil ------------------------------------------------

  function render3aVorteil(input, ktData, dreiA) {
    const out = document.getElementById('saeule3a-vorteil');
    const outVal = document.getElementById('saeule3a-out');
    if (!out || !outVal) return;
    outVal.textContent = fmtIntApostrophe(dreiA) + ' CHF';
    if (dreiA <= 0 || input.einkommen <= 0) {
      out.textContent = 'CHF 0.00';
      return;
    }
    const v = SteuerCalc.calc3aVorteil(input, state.bundData, ktData, dreiA);
    out.textContent = 'CHF ' + fmtChf(v);
  }

  // --- Render: Berechnungsweg-Trace --------------------------------------

  function renderTrace(input, inputEffektiv, ktData) {
    const box = document.getElementById('trace-box');
    const content = document.getElementById('trace-content');
    if (!box || !content) return;
    if (!document.getElementById('btn-trace').checked) { box.hidden = true; return; }
    box.hidden = false;
    const bund = SteuerCalc.traceBundessteuer(state.bundData, inputEffektiv.einkommen, inputEffektiv.zivilstand);
    const kt = SteuerCalc.traceKanton(ktData, inputEffektiv.einkommen, inputEffektiv.zivilstand, inputEffektiv.gemeinde, inputEffektiv.konfession);
    content.innerHTML =
      '<h4>Bundessteuer</h4><pre>' + bund.join('\n') + '</pre>' +
      '<h4>Kanton + Gemeinde + Kirche</h4><pre>' + kt.join('\n') + '</pre>';
  }

  // --- Reverse Search ----------------------------------------------------

  function onReverseSearch() {
    const wunsch = Number(document.getElementById('reverse-netto').value);
    if (!Number.isFinite(wunsch) || wunsch <= 0) {
      document.getElementById('reverse-out').textContent = 'Bitte einen gültigen Wunsch-Netto eingeben.';
      return;
    }
    const input = readInput();
    const out = document.getElementById('reverse-out');
    out.innerHTML = 'Berechne …';
    // Fuer jeden Kanton: ermittle benoetigtes Brutto am Hauptort
    const lines = [];
    KANTONE.forEach(function (kt) {
      const data = state.kantone[kt];
      if (!data) return;
      const gemeinde = state.hauptorte[kt];
      try {
        const brutto = SteuerCalc.reverseSearch(wunsch, state.bundData, data, input.zivilstand, gemeinde, input.konfession);
        lines.push({ kt: kt, gemeinde: gemeinde, brutto: brutto });
      } catch (e) { /* ignore */ }
    });
    lines.sort(function (a, b) { return a.brutto - b.brutto; });
    out.innerHTML = '<table class="result-table compact"><thead><tr><th>Kanton</th><th>Hauptort</th><th>Nötiges Brutto/Jahr</th></tr></thead><tbody>' +
      lines.map(function (l) {
        return '<tr><td>' + l.kt + '</td><td>' + l.gemeinde + '</td><td>CHF ' + fmtChf(l.brutto) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  // --- CSV Export --------------------------------------------------------

  function onCsvExport() {
    if (!state.lastResults) { showError('Erst eine Berechnung durchführen.'); return; }
    const v = state.lastResults.vergleich;
    const lines = ['Kanton;Gemeinde;Bund;Kanton;Gemeinde;Kirche;Vermoegen;Total'];
    v.forEach(function (r) {
      lines.push([r.kanton, r.gemeinde, r.bund.toFixed(2), r.kantonssteuer.toFixed(2),
        r.gemeindesteuer.toFixed(2), r.kirchensteuer.toFixed(2),
        (r.vermoegenssteuer || 0).toFixed(2), r.total.toFixed(2)].join(';'));
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'kantonsvergleich_' + state.lastResults.input.einkommen + '.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // --- URL-State ---------------------------------------------------------

  // Baut den Query-String aus den aktuellen Eingaben.
  function buildQuery(input, dreiA) {
    const params = new URLSearchParams();
    params.set('e', String(input.einkommen));
    params.set('z', input.zivilstand);
    params.set('k', input.konfession);
    params.set('kt', input.kanton);
    params.set('g', input.gemeinde);
    if (input.vermoegen > 0) params.set('vm', String(input.vermoegen));
    if (dreiA > 0) params.set('a', String(dreiA));
    return params.toString();
  }

  function syncUrl(input, dreiA) {
    // history.replaceState ist auf file:// nicht erlaubt (eindeutige Security-Origin)
    // und wuerde eine Konsolen-Warnung erzeugen. Nur ueber http(s) ausfuehren.
    if (location.protocol === 'file:') return;
    const url = location.pathname + '?' + buildQuery(input, dreiA);
    try {
      history.replaceState(null, '', url);
    } catch (e) {
      /* ignore (z.B. Sandbox-Einschraenkungen) */
    }
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.has('e')) return false;
    const input = {
      einkommen: Number(params.get('e')),
      vermoegen: params.has('vm') ? Number(params.get('vm')) : 0,
      zivilstand: params.get('z') || 'ledig',
      konfession: params.get('k') || 'keine',
      kanton: params.get('kt') || 'ZH',
      gemeinde: params.get('g') || ''
    };
    setInput(input);
    if (params.has('a')) {
      const a = Number(params.get('a'));
      const sl = document.getElementById('saeule3a');
      if (sl) sl.value = a;
    }
    return true;
  }

  function onShare() {
    // Link aus dem aktuellen Zustand bauen (funktioniert auch auf file://,
    // wo die Adresszeile die Parameter nicht enthaelt).
    const base = location.href.split('?')[0];
    const url = base + '?' + buildQuery(readInput(), read3a());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        showToast('Link kopiert. Wer ihn öffnet, sieht genau deine Eingaben.');
      }, function () { prompt('Link:', url); });
    } else {
      prompt('Link:', url);
    }
  }

  // --- Toast -------------------------------------------------------------

  let _toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  // --- Reset -------------------------------------------------------------

  function onReset() {
    setInput({ einkommen: 80000, vermoegen: 0, zivilstand: 'ledig', konfession: 'keine', kanton: 'ZH', gemeinde: state.hauptorte.ZH });
    document.getElementById('saeule3a').value = 0;
    showToast('Zurückgesetzt');
    rechnen();
  }

  // --- Dark Mode ---------------------------------------------------------

  const THEME_KEY = 'steuerrechner.theme.v1';
  function applyTheme(t) {
    document.body.dataset.theme = t;
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = (t === 'dark') ? '☼' : '☽';
  }
  function loadTheme() {
    let t = 'light';
    try { t = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { /* ignore */ }
    applyTheme(t);
  }
  function toggleTheme() {
    const cur = document.body.dataset.theme || 'light';
    const next = (cur === 'dark') ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
    applyTheme(next);
    if (state.lastResults) rechnen(); // Diagramme lesen die Farben aus den CSS-Variablen
  }

  // --- Saved Scenarios ---------------------------------------------------

  function refreshScenarioList() {
    const list = document.getElementById('scenario-list');
    const counter = document.getElementById('scenario-count');
    if (!list) return;
    list.innerHTML = '';
    const items = SteuerStorage.listScenarios();
    if (counter) counter.textContent = items.length + ' / ' + SteuerStorage.MAX_SCENARIOS;

    if (items.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Noch keine gespeicherten Szenarien.';
      list.appendChild(li); return;
    }

    items.forEach(function (s) {
      const li = document.createElement('li');
      li.dataset.name = s.name;
      const meta = fmtIntApostrophe(s.einkommen) + ' CHF, ' + s.zivilstand + ', ' + s.kanton + '/' + s.gemeinde;
      li.innerHTML =
        '<span class="sc-name">' + escapeHtml(s.name) + '</span>' +
        '<span class="sc-meta">' + escapeHtml(meta) + '</span>' +
        '<span class="sc-actions">' +
          '<button type="button" data-action="load">Laden</button>' +
          '<button type="button" data-action="rename">Umbenennen</button>' +
          '<button type="button" data-action="delete">Löschen</button>' +
          '<input type="checkbox" class="sc-compare" aria-label="Für Vergleich auswählen">' +
        '</span>';
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function onScenarioListClick(evt) {
    const btn = evt.target.closest('button[data-action]');
    if (!btn) return;
    const li = btn.closest('li[data-name]');
    if (!li) return;
    const name = li.dataset.name;
    const action = btn.dataset.action;

    if (action === 'load') {
      const r = SteuerStorage.loadScenario(name);
      if (!r.ok) { showError(r.error); return; }
      setInput(r.data); rechnen();
    } else if (action === 'delete') {
      if (confirm('Szenario "' + name + '" wirklich löschen?')) {
        const r = SteuerStorage.deleteScenario(name);
        if (!r.ok) { showError(r.error); return; }
        refreshScenarioList();
      }
    } else if (action === 'rename') {
      const neu = prompt('Neuer Name für "' + name + '":', name);
      if (neu === null) return;
      const v = SteuerValidate.validateScenarioName(neu);
      if (!v.valid) { showError(v.errors.join(' ')); return; }
      const r = SteuerStorage.renameScenario(name, v.value);
      if (!r.ok) { showError(r.error); return; }
      refreshScenarioList();
    }
  }

  function onSaveScenario() {
    const input = readInput();
    const ktData = state.kantone[input.kanton];
    const gemeinden = ktData ? Object.keys(ktData.gemeinden) : null;
    const iv = SteuerValidate.validateInput(input, gemeinden);
    if (!iv.valid) { showError(iv.errors.join(' ')); return; }
    const name = prompt('Name für das Szenario:');
    if (name === null) return;
    const v = SteuerValidate.validateScenarioName(name);
    if (!v.valid) { showError(v.errors.join(' ')); return; }
    const r = SteuerStorage.saveScenario(v.value, input);
    if (!r.ok) { showError(r.error); return; }
    refreshScenarioList();
    showToast('Szenario «' + v.value + '» gespeichert');
  }

  function onCompareScenarios() {
    const checked = Array.from(document.querySelectorAll('.sc-compare:checked'));
    if (checked.length !== 2) { showError('Bitte genau zwei Szenarien für den Vergleich auswählen.'); return; }
    const names = checked.map(function (c) { return c.closest('li').dataset.name; });
    const a = SteuerStorage.loadScenario(names[0]).data;
    const b = SteuerStorage.loadScenario(names[1]).data;
    const ra = SteuerCalc.calcGesamt(a, state.bundData, state.kantone[a.kanton]);
    const rb = SteuerCalc.calcGesamt(b, state.bundData, state.kantone[b.kanton]);
    const out = document.getElementById('compare-result');
    out.innerHTML =
      '<table><thead><tr><th>Posten</th><th>' + escapeHtml(names[0]) + '</th><th>' + escapeHtml(names[1]) + '</th></tr></thead><tbody>' +
      tr3('Einkommen', 'CHF ' + fmtChf(a.einkommen), 'CHF ' + fmtChf(b.einkommen)) +
      tr3('Kanton/Gemeinde', a.kanton + ' / ' + a.gemeinde, b.kanton + ' / ' + b.gemeinde) +
      tr3('Bund',     'CHF ' + fmtChf(ra.bund),         'CHF ' + fmtChf(rb.bund)) +
      tr3('Kanton',   'CHF ' + fmtChf(ra.kantonssteuer),'CHF ' + fmtChf(rb.kantonssteuer)) +
      tr3('Gemeinde', 'CHF ' + fmtChf(ra.gemeindesteuer),'CHF ' + fmtChf(rb.gemeindesteuer)) +
      tr3('Kirche',   'CHF ' + fmtChf(ra.kirchensteuer),'CHF ' + fmtChf(rb.kirchensteuer)) +
      tr3('Vermögen', 'CHF ' + fmtChf(ra.vermoegenssteuer || 0), 'CHF ' + fmtChf(rb.vermoegenssteuer || 0)) +
      '<tr class="row-total"><th>Total</th><td>CHF ' + fmtChf(ra.total) + '</td><td>CHF ' + fmtChf(rb.total) + '</td></tr>' +
      '</tbody></table>';
    out.hidden = false;
  }
  function tr3(l, a, b) { return '<tr><th>' + escapeHtml(l) + '</th><td>' + escapeHtml(a) + '</td><td>' + escapeHtml(b) + '</td></tr>'; }

  // --- Eingabe-Formatierung (Apostrophe Tausender) -----------------------

  function bindEinkommenInput() {
    const display = document.getElementById('einkommen-display');
    const hidden = document.getElementById('einkommen');
    if (!display || !hidden) return;

    function sync() {
      const n = parseEinkommenInput(display.value);
      if (Number.isFinite(n) && n >= 0) {
        hidden.value = n;
      } else {
        hidden.value = '';
      }
    }
    display.addEventListener('input', function () {
      sync();
      debouncedRechnen();
    });
    display.addEventListener('blur', function () {
      const n = parseEinkommenInput(display.value);
      if (Number.isFinite(n) && n >= 0) display.value = fmtIntApostrophe(n);
    });
  }

  // --- Init / Bindings ---------------------------------------------------

  function bindEvents() {
    document.getElementById('kanton').addEventListener('change', function () {
      refreshGemeinden(); debouncedRechnen();
    });
    document.getElementById('gemeinde').addEventListener('change', debouncedRechnen);
    document.getElementById('zivilstand').addEventListener('change', debouncedRechnen);
    document.getElementById('konfession').addEventListener('change', debouncedRechnen);
    document.getElementById('saeule3a').addEventListener('input', debouncedRechnen);
    document.getElementById('vermoegen').addEventListener('input', debouncedRechnen);
    document.getElementById('btn-trace').addEventListener('change', function () {
      if (state.lastResults) {
        const r = state.lastResults;
        renderTrace(r.input, r.inputEffektiv, state.kantone[r.input.kanton]);
      }
    });
    document.getElementById('form-eingabe').addEventListener('submit', function (e) {
      e.preventDefault(); rechnen();
    });
    document.getElementById('btn-speichern').addEventListener('click', onSaveScenario);
    document.getElementById('btn-share').addEventListener('click', onShare);
    document.getElementById('btn-reset').addEventListener('click', onReset);
    document.getElementById('btn-csv').addEventListener('click', onCsvExport);
    document.getElementById('btn-reverse').addEventListener('click', onReverseSearch);
    document.getElementById('reverse-netto').addEventListener('input', function () {
      clearTimeout(state.reverseTimer);
      state.reverseTimer = setTimeout(onReverseSearch, 250);
    });
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('scenario-list').addEventListener('click', onScenarioListClick);
    document.getElementById('btn-compare').addEventListener('click', onCompareScenarios);
    bindEinkommenInput();
  }

  function init() {
    fillKantonDropdown();
    loadTheme();
    loadAllData().then(function () {
      showPlatzhalterBannerIfNeeded();
      refreshGemeinden();
      const fromUrl = loadFromUrl();
      if (!fromUrl) refreshGemeinden();
      refreshScenarioList();
      bindEvents();
      rechnen();
    }).catch(function (e) {
      showError('Daten konnten nicht geladen werden: ' + (e.message || e) +
        ' (Tipp: Seite über http(s):// öffnen oder data/embedded.js nutzen.)');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
