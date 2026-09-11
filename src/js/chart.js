// chart.js - Chart.js Wrapper. Erwartet globales `Chart` von Chart.js (CDN).

(function (global) {
  'use strict';

  let _bar = null;
  let _line = null;

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

    const datasets = [
      { label: 'Bund',     data: bund,   backgroundColor: '#1f4e7a' },
      { label: 'Kanton',   data: kanton, backgroundColor: '#3b82c4' },
      { label: 'Gemeinde', data: gem,    backgroundColor: '#7fb3e0' },
      { label: 'Kirche',   data: kirche, backgroundColor: '#c1ddf2' }
    ];
    if (hatVermoegen) {
      datasets.push({ label: 'Vermögen', data: verm, backgroundColor: '#b5985a' });
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
          title: { display: true, text: 'Steuerlast pro Kanton (CHF)' },
          tooltip: {
            callbacks: {
              footer: function (items) {
                const idx = items[0].dataIndex;
                const r = vergleichResults[idx];
                return 'Total: CHF ' + totals[idx].toLocaleString('de-CH') + ' (' + r.gemeinde + ')';
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
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

    const xs = points.map(function (p) { return p.einkommen; });
    const ys = points.map(function (p) { return +(p.satz * 100).toFixed(2); });

    const datasets = [{
      label: 'Effektiver Steuersatz (%)',
      data: ys,
      borderColor: '#1f4e7a',
      backgroundColor: 'rgba(31, 78, 122, 0.15)',
      fill: true,
      pointRadius: 0,
      tension: 0.2
    }];

    if (typeof currentEinkommen === 'number' && currentEinkommen > 0) {
      const idx = xs.findIndex(function (x) { return x >= currentEinkommen; });
      if (idx >= 0) {
        datasets.push({
          label: 'Aktuelles Einkommen',
          data: ys.map(function (_, i) { return i === idx ? ys[idx] : null; }),
          pointBackgroundColor: '#d9450b',
          pointRadius: 6,
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
        plugins: {
          title: { display: false },
          tooltip: {
            callbacks: {
              title: function (items) { return 'CHF ' + Number(items[0].label).toLocaleString('de-CH'); },
              label: function (item) {
                if (item.dataset.label === 'Aktuelles Einkommen') return 'Hier bist du';
                return 'Satz: ' + item.formattedValue + ' %';
              }
            }
          }
        },
        scales: {
          x: {
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
