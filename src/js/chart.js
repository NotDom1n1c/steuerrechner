// chart.js - Chart.js Wrapper. Erwartet globales `Chart` von Chart.js (CDN).

(function (global) {
  'use strict';

  let _bar = null;
  let _line = null;

  // Farben aus den CSS-Variablen lesen, damit Light/Dark Mode automatisch passen
  function css(name, fallback) {
    const v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback;
  }
  function applyDefaults() {
    Chart.defaults.font.family = css('--font', 'sans-serif');
    Chart.defaults.font.size = 12;
    Chart.defaults.color = css('--muted', '#666');
    Chart.defaults.borderColor = css('--line', '#ddd');
  }
  function tooltipStyle() {
    return {
      backgroundColor: css('--ink', '#111'),
      titleColor: css('--paper', '#fff'),
      bodyColor: css('--paper', '#fff'),
      footerColor: css('--paper', '#fff'),
      padding: 10, cornerRadius: 4, displayColors: true, boxPadding: 4
    };
  }

  // Stacked Bar Chart fuer Vergleich aller Kantone.
  function renderBarChart(canvasEl, vergleichResults) {
    if (typeof Chart === 'undefined' || !canvasEl) return;

    const labels = vergleichResults.map(function (r) { return r.kanton; });
    const totals = vergleichResults.map(function (r) { return Math.round(r.total); });
    const bund   = vergleichResults.map(function (r) { return Math.round(r.bund); });
    const kanton = vergleichResults.map(function (r) { return Math.round(r.kantonssteuer); });
    const gem    = vergleichResults.map(function (r) { return Math.round(r.gemeindesteuer); });
    const kirche = vergleichResults.map(function (r) { return Math.round(r.kirchensteuer); });
    const verm   = vergleichResults.map(function (r) { return Math.round(r.vermoegenssteuer || 0); });
    const hatVermoegen = verm.some(function (v) { return v > 0; });

    if (_bar) { _bar.destroy(); _bar = null; }
    applyDefaults();

    const bar = { borderRadius: 0, borderSkipped: false, maxBarThickness: 64 };
    const datasets = [
      Object.assign({ label: 'Bund',     data: bund,   backgroundColor: css('--s-bund', '#111') }, bar),
      Object.assign({ label: 'Kanton',   data: kanton, backgroundColor: css('--s-kanton', '#d52b1e') }, bar),
      Object.assign({ label: 'Gemeinde', data: gem,    backgroundColor: css('--s-gemeinde', '#ec8b78') }, bar),
      Object.assign({ label: 'Kirche',   data: kirche, backgroundColor: css('--s-kirche', '#b8ae9c') }, bar)
    ];
    if (hatVermoegen) {
      datasets.push(Object.assign({ label: 'Vermögen', data: verm, backgroundColor: css('--s-vermoegen', '#8c6a2f') }, bar));
    }

    _bar = new Chart(canvasEl.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: false },
          legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 12, padding: 16 } },
          tooltip: Object.assign(tooltipStyle(), {
            callbacks: {
              footer: function (items) {
                const idx = items[0].dataIndex;
                const r = vergleichResults[idx];
                return 'Total: CHF ' + totals[idx].toLocaleString('de-CH') + ' (' + r.gemeinde + ')';
              }
            }
          })
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { weight: '700', size: 13 }, color: css('--ink', '#111') } },
          y: {
            stacked: true,
            beginAtZero: true,
            border: { display: false },
            ticks: { callback: function (v) { return Number(v).toLocaleString('de-CH'); } }
          }
        }
      }
    });
  }

  // Linendiagramm der Progression (effektiver Steuersatz vs Einkommen).
  // points: [{ einkommen, satz }, ...]
  // currentEinkommen: optional, wird als Punkt markiert
  function renderProgressionChart(canvasEl, points, currentEinkommen) {
    if (typeof Chart === 'undefined' || !canvasEl) return;

    if (_line) { _line.destroy(); _line = null; }
    applyDefaults();
    const ink = css('--ink', '#111'), red = css('--red', '#d52b1e');

    const xs = points.map(function (p) { return p.einkommen; });
    const ys = points.map(function (p) { return +(p.satz * 100).toFixed(2); });

    const datasets = [{
      label: 'Effektiver Steuersatz (%)',
      data: ys,
      borderColor: ink,
      borderWidth: 2.5,
      backgroundColor: css('--red-soft', 'rgba(213,43,30,0.08)'),
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.25
    }];

    if (typeof currentEinkommen === 'number' && currentEinkommen > 0) {
      const idx = xs.findIndex(function (x) { return x >= currentEinkommen; });
      if (idx >= 0) {
        datasets.push({
          label: 'Aktuelles Einkommen',
          data: ys.map(function (_, i) { return i === idx ? ys[idx] : null; }),
          pointBackgroundColor: red,
          pointBorderColor: css('--card', '#fff'),
          pointBorderWidth: 3,
          pointRadius: 8,
          pointHoverRadius: 9,
          showLine: false,
          spanGaps: false
        });
      }
    }

    _line = new Chart(canvasEl.getContext('2d'), {
      type: 'line',
      data: { labels: xs, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          title: { display: false },
          legend: { display: false },
          tooltip: Object.assign(tooltipStyle(), {
            callbacks: {
              title: function (items) { return 'CHF ' + Number(items[0].label).toLocaleString('de-CH'); },
              label: function (item) {
                if (item.dataset.label === 'Aktuelles Einkommen') return 'Hier bist du';
                return 'Satz: ' + item.formattedValue + ' %';
              }
            }
          })
        },
        scales: {
          x: {
            grid: { display: false },
            title: { display: true, text: 'Einkommen (CHF)' },
            ticks: {
              callback: function (val, i) {
                const v = xs[i];
                return v >= 1000 ? (v / 1000) + 'k' : v;
              },
              maxTicksLimit: 12
            }
          },
          y: {
            title: { display: true, text: 'Satz (%)' },
            border: { display: false },
            beginAtZero: true,
            ticks: { callback: function (v) { return v + ' %'; } }
          }
        }
      }
    });
  }

  function destroy() {
    if (_bar) { _bar.destroy(); _bar = null; }
    if (_line) { _line.destroy(); _line = null; }
  }

  global.SteuerChart = {
    renderBarChart: renderBarChart,
    renderProgressionChart: renderProgressionChart,
    destroy: destroy
  };
})(typeof window !== 'undefined' ? window : globalThis);
