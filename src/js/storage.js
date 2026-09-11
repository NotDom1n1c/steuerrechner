// storage.js - localStorage-Wrapper
// Speichert nur Eingaben (nicht Resultate). Limit: 50 Szenarien.

(function (global) {
  'use strict';

  const STORAGE_KEY = 'steuerrechner.scenarios.v1';
  const MAX_SCENARIOS = 50;

  // Liest und parsed alle Szenarien. Bei korruptem JSON wird der Eintrag geloescht.
  function readAll() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return { ok: false, error: 'localStorage nicht verfuegbar.', data: {} };
    }
    if (!raw) return { ok: true, data: {} };
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return { ok: true, data: obj };
      return { ok: true, data: {} };
    } catch (e) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (ee) { /* ignore */ }
      return { ok: false, error: 'Gespeicherte Daten waren korrupt und wurden geloescht.', data: {} };
    }
  }

  function writeAll(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
      return { ok: true };
    } catch (e) {
      if (e && e.name === 'QuotaExceededError') {
        return { ok: false, error: 'Speicherplatz im Browser voll. Bitte alte Szenarien loeschen.' };
      }
      return { ok: false, error: 'Konnte nicht speichern: ' + (e && e.message ? e.message : e) };
    }
  }

  // Erstellt oder ersetzt ein Szenario unter dem gegebenen Namen.
  function saveScenario(name, input) {
    const r = readAll();
    if (!r.ok && !r.data) return r;
    const data = r.data;
    if (!Object.prototype.hasOwnProperty.call(data, name) && Object.keys(data).length >= MAX_SCENARIOS) {
      return { ok: false, error: 'Limit von ' + MAX_SCENARIOS + ' Szenarien erreicht. Bitte loeschen.' };
    }
    data[name] = {
      einkommen: Number(input.einkommen),
      vermoegen: Number(input.vermoegen) || 0,
      zivilstand: input.zivilstand,
      konfession: input.konfession,
      kanton: input.kanton,
      gemeinde: input.gemeinde,
      gespeichert: new Date().toISOString()
    };
    return writeAll(data);
  }

  function loadScenario(name) {
    const r = readAll();
    if (!Object.prototype.hasOwnProperty.call(r.data, name)) {
      return { ok: false, error: 'Szenario "' + name + '" nicht gefunden.' };
    }
    return { ok: true, data: r.data[name] };
  }

  function listScenarios() {
    const r = readAll();
    return Object.keys(r.data).sort().map(function (n) {
      return Object.assign({ name: n }, r.data[n]);
    });
  }

  function deleteScenario(name) {
    const r = readAll();
    if (!Object.prototype.hasOwnProperty.call(r.data, name)) {
      return { ok: false, error: 'Szenario "' + name + '" nicht gefunden.' };
    }
    delete r.data[name];
    return writeAll(r.data);
  }

  function renameScenario(oldName, newName) {
    const r = readAll();
    if (!Object.prototype.hasOwnProperty.call(r.data, oldName)) {
      return { ok: false, error: 'Szenario "' + oldName + '" nicht gefunden.' };
    }
    if (Object.prototype.hasOwnProperty.call(r.data, newName)) {
      return { ok: false, error: 'Name "' + newName + '" existiert bereits.' };
    }
    r.data[newName] = r.data[oldName];
    delete r.data[oldName];
    return writeAll(r.data);
  }

  function countScenarios() {
    return Object.keys(readAll().data).length;
  }

  function clearAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Konnte nicht loeschen.' };
    }
  }

  global.SteuerStorage = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_SCENARIOS: MAX_SCENARIOS,
    saveScenario: saveScenario,
    loadScenario: loadScenario,
    listScenarios: listScenarios,
    deleteScenario: deleteScenario,
    renameScenario: renameScenario,
    countScenarios: countScenarios,
    clearAll: clearAll
  };
})(typeof window !== 'undefined' ? window : globalThis);
