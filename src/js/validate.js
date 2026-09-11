// validate.js - Eingabevalidierung
// Reine Funktionen, keine DOM-Zugriffe. Gibt Liste von Fehlertexten zurueck.

(function (global) {
  'use strict';

  // Unterstuetzte Kantone (gemaess Aufgabenstellung, alle mit echten ESTV-Daten).
  const KANTONE = ['AG', 'BE', 'BS', 'ZG', 'ZH'];
  const ZIVILSTAND = ['ledig', 'verheiratet'];
  const KONFESSION = ['rk', 'ev', 'keine'];
  const MAX_EINKOMMEN = 100000000; // 100 Mio CHF Sicherheits-Obergrenze

  // Validiert ein Eingabeobjekt und gibt { valid: bool, errors: string[] } zurueck.
  function validateInput(input, gemeindenForKanton) {
    const errors = [];

    // Einkommen
    if (input.einkommen === undefined || input.einkommen === null || input.einkommen === '') {
      errors.push('Bruttoeinkommen fehlt.');
    } else {
      const n = Number(input.einkommen);
      if (Number.isNaN(n)) {
        errors.push('Bruttoeinkommen ist keine gueltige Zahl.');
      } else if (n < 0) {
        errors.push('Bruttoeinkommen darf nicht negativ sein.');
      } else if (n > MAX_EINKOMMEN) {
        errors.push('Bruttoeinkommen ist unrealistisch hoch (max. 100 Mio CHF).');
      } else if (!Number.isFinite(n)) {
        errors.push('Bruttoeinkommen ist nicht finit.');
      }
    }

    // Nettovermoegen (optional, Default 0)
    if (input.vermoegen !== undefined && input.vermoegen !== null && input.vermoegen !== '') {
      const v = Number(input.vermoegen);
      if (Number.isNaN(v)) {
        errors.push('Nettovermoegen ist keine gueltige Zahl.');
      } else if (v < 0) {
        errors.push('Nettovermoegen darf nicht negativ sein.');
      } else if (v > MAX_EINKOMMEN) {
        errors.push('Nettovermoegen ist unrealistisch hoch.');
      }
    }

    // Zivilstand
    if (!ZIVILSTAND.includes(input.zivilstand)) {
      errors.push('Zivilstand ungueltig (erlaubt: ledig, verheiratet).');
    }

    // Konfession
    if (!KONFESSION.includes(input.konfession)) {
      errors.push('Konfession ungueltig (erlaubt: rk, ev, keine).');
    }

    // Kanton
    if (!KANTONE.includes(input.kanton)) {
      errors.push('Kanton ungueltig (erlaubt: ' + KANTONE.join(', ') + ').');
    }

    // Gemeinde (nur wenn Liste mitgegeben wird)
    if (gemeindenForKanton && Array.isArray(gemeindenForKanton)) {
      if (!gemeindenForKanton.includes(input.gemeinde)) {
        errors.push('Gemeinde "' + input.gemeinde + '" nicht im gewaehlten Kanton.');
      }
    } else if (!input.gemeinde || typeof input.gemeinde !== 'string') {
      errors.push('Gemeinde fehlt.');
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // Validiert einen Szenarioname (1-50 Zeichen, keine leeren Strings).
  function validateScenarioName(name) {
    const errors = [];
    if (typeof name !== 'string') {
      errors.push('Name muss Text sein.');
      return { valid: false, errors: errors };
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) errors.push('Name darf nicht leer sein.');
    if (trimmed.length > 50) errors.push('Name darf max. 50 Zeichen lang sein.');
    return { valid: errors.length === 0, errors: errors, value: trimmed };
  }

  global.SteuerValidate = {
    KANTONE: KANTONE,
    ZIVILSTAND: ZIVILSTAND,
    KONFESSION: KONFESSION,
    MAX_EINKOMMEN: MAX_EINKOMMEN,
    validateInput: validateInput,
    validateScenarioName: validateScenarioName
  };
})(typeof window !== 'undefined' ? window : globalThis);
