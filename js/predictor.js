/* PRÉDICTEUR v48 — inférence véhicule + corrélations adossées au catalogue massif. */
window.EIK_PREDICTOR = (function () {
  "use strict";
  var VERSION = "48.0.0", EIK = window.EIK, CAT = window.EIK_CATALOG, W = window;
  function stats() { return CAT ? CAT.stats() : { brands: 0, models: 0, engines: 0, powers: 0, variants: 0, correlations: 0 }; }
  function publish() { var s = stats(); if (EIK) { EIK.predictorVersion = VERSION; EIK.vehicleCount = s.models; EIK.engineCount = s.engines; EIK.powerCount = s.powers; EIK.corrCount = s.correlations; EIK.setCheck("pred", "Moteur prédictif", "ok", VERSION + " · " + s.models + " modèles · " + s.powers + " puissances"); } }
  var ready = (async function () { if (CAT && CAT.ready) await CAT.ready; publish(); return stats(); })();
  if (W) W.addEventListener("eik-catalog", publish);
  return {
    version: VERSION, ready: ready,
    inferVehicle: function (q) { return CAT ? CAT.inferVehicle(q) : null; },
    findCorrelations: function (v) { return CAT ? CAT.findCorrelations(v) : []; },
    analyzePredictive: function (q) { var v = CAT ? CAT.inferVehicle(q) : null; return { vehicle: v, correlations: v && CAT ? CAT.findCorrelations(v) : [], confidence: v ? v.confidence : "Aucun véhicule détecté", query: q }; },
    searchVehicles: function (q, l) { return CAT ? CAT.searchVehicles(q, l) : []; },
    getStats: stats,
    getBrands: function () { return CAT ? CAT.getBrands() : []; },
    getModels: function () { return CAT ? CAT.getModels() : []; },
    getEngines: function () { return CAT ? CAT.getEngines() : []; },
    getCorrelations: function () { return CAT ? CAT.getCorrelations() : []; },
    enginesFor: function (b, m) { return CAT ? CAT.enginesFor(b, m) : []; },
    powersFor: function (b, m, e) { return CAT ? CAT.powersFor(b, m, e) : []; },
    modelsFor: function (b) { return CAT ? CAT.modelsFor(b) : []; },
    mergeCatalog: function (c) { return CAT ? CAT.mergeCatalog(c) : null; },
    exportCatalog: function () { return CAT ? CAT.exportCatalog() : {}; }
  };
})();
