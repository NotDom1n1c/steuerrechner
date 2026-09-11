// calc.js - Reine Berechnungsfunktionen (keine DOM-Zugriffe)
// Geld wird intern in Rappen (Ganzzahlen) verarbeitet, Eingabe in CHF.
// Quellen: DBG Art. 36 (Bund), kantonale Steuergesetze (siehe /docs/quellen.md)

(function (global) {
  'use strict';

  // --- Hilfsfunktionen ----------------------------------------------------

  // CHF (float) -> Rappen (int)
  function chfToRappen(chf) {
    return Math.round(chf * 100);
  }

  // Rappen (int) -> CHF (float, 2 Nachkommastellen)
  function rappenToChf(rappen) {
    return Math.round(rappen) / 100;
  }

  // Findet die passende Stufe in einer Tarif-Tabelle
  // tarif: Array von { bis, fix, satz, ueber }
  // einkommen: in CHF (float)
  function findStufe(tarif, einkommen) {
    for (let i = 0; i < tarif.length; i++) {
      const stufe = tarif[i];
      if (stufe.bis === null || einkommen <= stufe.bis) {
        return stufe;
      }
    }
    return tarif[tarif.length - 1];
  }

  // --- Bundessteuer (DBG Art. 36) ----------------------------------------

  // Berechnet die Bundessteuer (einfache Steuer) in CHF.
  // bundData: bundessteuer_2026.json
  // einkommen: steuerbares Einkommen in CHF
  // zivilstand: 'ledig' | 'verheiratet'
  function calcBundessteuer(bundData, einkommen, zivilstand) {
    if (einkommen <= 0) return 0;
    const tarif = zivilstand === 'verheiratet'
      ? bundData.tarif_verheiratet
      : bundData.tarif_ledig;

    const stufe = findStufe(tarif, einkommen);

    // Pauschalstufe: ab Schwellwert wird der Satz auf das gesamte Einkommen angewendet (Bund: max-Tarif).
    if (stufe._pauschal) {
      // In Rappen rechnen
      const rappenEink = chfToRappen(einkommen);
      const rappenSteuer = Math.round(rappenEink * stufe.satz);
      return rappenToChf(rappenSteuer);
    }

    // Standardstufe: fix + satz * (einkommen - ueber)
    const rappenEink = chfToRappen(einkommen);
    const rappenUeber = chfToRappen(stufe.ueber);
    const differenz = rappenEink - rappenUeber;
    const variable = Math.round(differenz * stufe.satz);
    const fix = chfToRappen(stufe.fix);
    return rappenToChf(fix + variable);
  }

  // --- Kantonale einfache Staatssteuer ----------------------------------

  // Berechnet die einfache Kantonssteuer (vor Steuerfuss) in CHF.
  // kantonData: z. B. kanton_zh.json
  function calcEinfacheSteuer(kantonData, einkommen, zivilstand) {
    if (einkommen <= 0) return 0;
    const tarif = zivilstand === 'verheiratet'
      ? kantonData.tarif_verheiratet
      : kantonData.tarif_ledig;

    const stufe = findStufe(tarif, einkommen);
    const rappenEink = chfToRappen(einkommen);
    const rappenUeber = chfToRappen(stufe.ueber);
    const differenz = rappenEink - rappenUeber;
    const variable = Math.round(differenz * stufe.satz);
    const fix = chfToRappen(stufe.fix);
    return rappenToChf(fix + variable);
  }

  // Berechnet die einfache Vermoegenssteuer (vor Steuerfuss) in CHF.
  // vermoegen: steuerbares Nettovermoegen. Gibt 0 zurueck, wenn keine
  // Vermoegens-Tarife hinterlegt sind (KANN-Feature, optional pro Kanton).
  function calcEinfacheVermoegen(kantonData, vermoegen, zivilstand) {
    if (!vermoegen || vermoegen <= 0) return 0;
    const tarif = zivilstand === 'verheiratet'
      ? kantonData.tarif_vermoegen_verheiratet
      : kantonData.tarif_vermoegen_ledig;
    if (!tarif || tarif.length === 0) return 0;

    const stufe = findStufe(tarif, vermoegen);
    const rappenVerm = chfToRappen(vermoegen);
    const rappenUeber = chfToRappen(stufe.ueber);
    const differenz = rappenVerm - rappenUeber;
    const variable = Math.round(differenz * stufe.satz);
    const fix = chfToRappen(stufe.fix);
    return rappenToChf(fix + variable);
  }

  // --- Kantonssteuer, Gemeindesteuer, Kirchensteuer ---------------------

  // Wendet einen Steuerfuss (in Prozent, z.B. 119) auf die einfache Steuer an.
  function applyFuss(einfacheSteuer, fussProzent) {
    const rappen = chfToRappen(einfacheSteuer);
    const result = Math.round(rappen * (fussProzent / 100));
    return rappenToChf(result);
  }

  // Loest Gemeinde-Steuerfuss + Kirchensteuerfuss auf.
  // Unterstuetzt zwei Datenmodelle:
  //  a) Echtdaten:   gemeinden[g] = { fuss, rk, ev }  (Kirche pro Gemeinde)
  //  b) Platzhalter: gemeinden[g] = 119               (Kirche auf Kantonsebene)
  // konfession: 'rk' | 'ev' | 'keine'
  function resolveGemeinde(kantonData, gemeinde, konfession) {
    const entry = kantonData.gemeinden[gemeinde];
    if (entry === undefined) {
      throw new Error('Unbekannte Gemeinde "' + gemeinde + '" in Kanton ' + kantonData.kanton);
    }
    if (typeof entry === 'object' && entry !== null) {
      const kirche = (konfession === 'rk' || konfession === 'ev') ? (entry[konfession] || 0) : 0;
      return { gemeindeFuss: entry.fuss, kircheFuss: kirche };
    }
    // Platzhalter-Modell: Zahl + Kantons-Kirchensteuer
    const kircheFuss = (kantonData.kirchensteuer && kantonData.kirchensteuer[konfession]) || 0;
    return { gemeindeFuss: entry, kircheFuss: kircheFuss };
  }

  // Komplette Kantons-Berechnung (Einkommens- UND Vermoegenssteuer).
  // Derselbe Steuerfuss (Kanton + Gemeinde + Kirche) multipliziert beide
  // einfachen Steuern. Der Bund kennt KEINE Vermoegenssteuer.
  // konfession: 'rk' | 'ev' | 'keine'; vermoegen: optional, Default 0.
  function calcKantonsTotal(kantonData, einkommen, zivilstand, gemeinde, konfession, vermoegen) {
    const einfache = calcEinfacheSteuer(kantonData, einkommen, zivilstand);
    const einfacheVerm = calcEinfacheVermoegen(kantonData, vermoegen || 0, zivilstand);

    const resolved = resolveGemeinde(kantonData, gemeinde, konfession);
    const kFuss = kantonData.kantonssteuerfuss;
    const gFuss = resolved.gemeindeFuss;
    const kiFuss = resolved.kircheFuss;

    // Einkommenssteuer-Anteile
    const kanton = applyFuss(einfache, kFuss);
    const gemeindeSteuer = applyFuss(einfache, gFuss);
    const kirche = applyFuss(einfache, kiFuss);

    // Vermoegenssteuer-Anteile (gleicher Steuerfuss)
    const vKanton = applyFuss(einfacheVerm, kFuss);
    const vGemeinde = applyFuss(einfacheVerm, gFuss);
    const vKirche = applyFuss(einfacheVerm, kiFuss);
    const vermoegenssteuer = rappenToChf(chfToRappen(vKanton) + chfToRappen(vGemeinde) + chfToRappen(vKirche));

    return {
      einfache_steuer: einfache,
      einfache_vermoegen: einfacheVerm,
      kanton: kanton,
      gemeinde: gemeindeSteuer,
      kirche: kirche,
      vermoegenssteuer: vermoegenssteuer,
      total: rappenToChf(chfToRappen(kanton) + chfToRappen(gemeindeSteuer) + chfToRappen(kirche))
    };
  }

  // --- Gesamtberechnung ---------------------------------------------------

  // Komplettes Resultat fuer einen Kanton inkl. Bund.
  // input.vermoegen ist optional (Default 0) -> dann verhaelt sich alles wie zuvor.
  function calcGesamt(input, bundData, kantonData) {
    const bund = calcBundessteuer(bundData, input.einkommen, input.zivilstand);
    const kt = calcKantonsTotal(
      kantonData,
      input.einkommen,
      input.zivilstand,
      input.gemeinde,
      input.konfession,
      input.vermoegen || 0
    );
    const einkommenssteuer = rappenToChf(
      chfToRappen(bund) +
      chfToRappen(kt.kanton) +
      chfToRappen(kt.gemeinde) +
      chfToRappen(kt.kirche)
    );
    const total = rappenToChf(chfToRappen(einkommenssteuer) + chfToRappen(kt.vermoegenssteuer));
    return {
      kanton: kantonData.kanton,
      kanton_name: kantonData.kanton_name,
      gemeinde: input.gemeinde,
      bund: bund,
      einfache_steuer: kt.einfache_steuer,
      einfache_vermoegen: kt.einfache_vermoegen,
      kantonssteuer: kt.kanton,
      gemeindesteuer: kt.gemeinde,
      kirchensteuer: kt.kirche,
      vermoegenssteuer: kt.vermoegenssteuer,
      einkommenssteuer_total: einkommenssteuer,
      total: total,
      effektiver_satz: input.einkommen > 0 ? total / input.einkommen : 0
    };
  }

  // Vergleich ueber alle Kantone, gibt Array sortiert nach Total aufsteigend.
  // kantoneMap: { ZH: kantonData_ZH, BS: ..., ... }
  // Bei Vergleich wird pro Kanton der Hauptort als Default-Gemeinde benutzt,
  // ausser der gewaehlte Kanton entspricht dem aktuell gewaehlten (dort wird gemeinde uebernommen).
  function calcVergleich(input, bundData, kantoneMap, hauptorte) {
    const out = [];
    Object.keys(kantoneMap).forEach(function (kt) {
      const kantonData = kantoneMap[kt];
      const gemeinde = (kt === input.kanton)
        ? input.gemeinde
        : hauptorte[kt];
      const inp = Object.assign({}, input, { kanton: kt, gemeinde: gemeinde });
      out.push(calcGesamt(inp, bundData, kantonData));
    });
    out.sort(function (a, b) { return a.total - b.total; });
    return out;
  }

  // --- Berechnungsweg (didaktisch) --------------------------------------

  // Liefert eine schrittweise Erklaerung der Tarifanwendung als Array von Strings.
  function traceBundessteuer(bundData, einkommen, zivilstand) {
    if (einkommen <= 0) return ['Einkommen 0 -> Bundessteuer 0.'];
    const tarif = zivilstand === 'verheiratet' ? bundData.tarif_verheiratet : bundData.tarif_ledig;
    const stufe = findStufe(tarif, einkommen);
    const out = [];
    out.push('Tarif Bund (' + zivilstand + '), DBG Art. 36');
    if (stufe._pauschal) {
      const steuer = einkommen * stufe.satz;
      out.push('Pauschal-Stufe: ' + einkommen.toFixed(2) + ' x ' + (stufe.satz * 100).toFixed(2) + ' % = ' + steuer.toFixed(2));
      return out;
    }
    out.push('Stufe ' + stufe.ueber.toFixed(0) + ' bis ' + (stufe.bis === null ? 'oo' : stufe.bis.toFixed(0)));
    out.push('Sockel: CHF ' + stufe.fix.toFixed(2));
    const diff = einkommen - stufe.ueber;
    const variable = diff * stufe.satz;
    out.push('+ (' + einkommen.toFixed(2) + ' - ' + stufe.ueber.toFixed(2) + ') x ' + (stufe.satz * 100).toFixed(3) + ' %');
    out.push('= ' + stufe.fix.toFixed(2) + ' + ' + variable.toFixed(2));
    out.push('= CHF ' + (stufe.fix + variable).toFixed(2));
    return out;
  }

  function traceKanton(kantonData, einkommen, zivilstand, gemeinde, konfession) {
    if (einkommen <= 0) return ['Einkommen 0 -> alle kantonalen Steuern 0.'];
    const tarif = zivilstand === 'verheiratet' ? kantonData.tarif_verheiratet : kantonData.tarif_ledig;
    const stufe = findStufe(tarif, einkommen);
    const out = [];
    out.push('Tarif Kanton ' + kantonData.kanton + ' (' + zivilstand + ')');
    out.push('Stufe ' + stufe.ueber.toFixed(0) + ' bis ' + (stufe.bis === null ? 'oo' : stufe.bis.toFixed(0)));
    out.push('Einfache Steuer = ' + stufe.fix.toFixed(2) + ' + (' + einkommen.toFixed(2) + ' - ' + stufe.ueber.toFixed(2) + ') x ' + (stufe.satz * 100).toFixed(3) + ' %');
    const einf = stufe.fix + (einkommen - stufe.ueber) * stufe.satz;
    out.push('Einfache Steuer = CHF ' + einf.toFixed(2));
    out.push('Kantonssteuer = einfache x ' + kantonData.kantonssteuerfuss + ' % = ' + (einf * kantonData.kantonssteuerfuss / 100).toFixed(2));
    const resolved = resolveGemeinde(kantonData, gemeinde, konfession);
    const gFuss = resolved.gemeindeFuss;
    const kFuss = resolved.kircheFuss;
    out.push('Gemeindesteuer ' + gemeinde + ' = einfache x ' + gFuss + ' % = ' + (einf * gFuss / 100).toFixed(2));
    if (kFuss > 0) {
      out.push('Kirchensteuer = einfache x ' + kFuss + ' % = ' + (einf * kFuss / 100).toFixed(2));
    } else {
      out.push('Kirchensteuer = 0 (Konfession: ' + konfession + ')');
    }
    return out;
  }

  // --- Marginal- / Durchschnittssatz -------------------------------------

  // Marginalsatz = Steuerlast einer Erhoehung um 100 CHF
  function calcMarginalsatz(input, bundData, kantonData) {
    if (input.einkommen <= 0) return 0;
    const a = calcGesamt(input, bundData, kantonData).total;
    const inp2 = Object.assign({}, input, { einkommen: input.einkommen + 100 });
    const b = calcGesamt(inp2, bundData, kantonData).total;
    return (b - a) / 100; // Anteil
  }

  // --- Saeule 3a Steuervorteil -------------------------------------------

  // Gibt die Steuerersparnis bei einer 3a-Einzahlung von `betrag` zurueck.
  // Annahme: die Einzahlung reduziert das steuerbare Einkommen 1:1.
  function calc3aVorteil(input, bundData, kantonData, betrag) {
    if (betrag <= 0 || input.einkommen <= 0) return 0;
    const ohne = calcGesamt(input, bundData, kantonData).total;
    const inp2 = Object.assign({}, input, { einkommen: Math.max(0, input.einkommen - betrag) });
    const mit = calcGesamt(inp2, bundData, kantonData).total;
    return ohne - mit;
  }

  // --- Reverse-Search (KANN-Feature) -------------------------------------

  // Sucht Brutto-Einkommen (jaehrlich) so, dass Netto pro Monat ~ wunschNettoMonat.
  // Vereinfacht: Netto = Brutto - Total-Steuer, dann /12.
  // Binaere Suche, max 30 Iterationen, Toleranz 5 CHF/Monat.
  function reverseSearch(wunschNettoMonat, bundData, kantonData, zivilstand, gemeinde, konfession) {
    let lo = 0;
    let hi = 2000000;
    const ziel = wunschNettoMonat * 12;
    const tol = 60;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      const r = calcGesamt(
        { einkommen: mid, zivilstand: zivilstand, gemeinde: gemeinde, konfession: konfession, kanton: kantonData.kanton },
        bundData,
        kantonData
      );
      const netto = mid - r.total;
      if (Math.abs(netto - ziel) <= tol) {
        return Math.round(mid);
      }
      if (netto < ziel) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return Math.round((lo + hi) / 2);
  }

  // --- Export -------------------------------------------------------------

  const api = {
    chfToRappen: chfToRappen,
    rappenToChf: rappenToChf,
    findStufe: findStufe,
    calcBundessteuer: calcBundessteuer,
    calcEinfacheSteuer: calcEinfacheSteuer,
    calcEinfacheVermoegen: calcEinfacheVermoegen,
    applyFuss: applyFuss,
    resolveGemeinde: resolveGemeinde,
    calcKantonsTotal: calcKantonsTotal,
    calcGesamt: calcGesamt,
    calcVergleich: calcVergleich,
    reverseSearch: reverseSearch,
    traceBundessteuer: traceBundessteuer,
    traceKanton: traceKanton,
    calcMarginalsatz: calcMarginalsatz,
    calc3aVorteil: calc3aVorteil
  };

  global.SteuerCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
