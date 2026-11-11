/* Moteur prédictif v45 — inférence marques/modèles/motorisations/puissances + corrélations.
   Base massive EMBARQUÉE (fonctionne hors ligne / APK même si data/*.json absents), fusion avec fichiers distants. */
window.EIK_PREDICTOR = (function () {
  "use strict";
  var VERSION = "45.0.0";
  var EIK = window.EIK;
  var D = document, W = window;
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function uniq(a) { var o = {}, r = []; (a || []).forEach(function (x) { if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }

  var EMBED = {
    brands: [
      { name: "Peugeot", aliases: ["peugeot", "psa"] }, { name: "Citroën", aliases: ["citroen", "citroën", "psa"] }, { name: "DS", aliases: ["ds automobiles", "psa"] }, { name: "Opel", aliases: ["opel", "stellantis"] }, { name: "Renault", aliases: ["renault"] }, { name: "Dacia", aliases: ["dacia"] }, { name: "Volkswagen", aliases: ["vw", "volkswagen", "vag"] }, { name: "Audi", aliases: ["audi", "vag"] }, { name: "SEAT", aliases: ["seat", "vag"] }, { name: "Škoda", aliases: ["skoda", "vag"] }, { name: "Ford", aliases: ["ford"] }, { name: "BMW", aliases: ["bmw"] }, { name: "Mercedes-Benz", aliases: ["mercedes", "daimler"] }, { name: "Toyota", aliases: ["toyota"] }, { name: "Honda", aliases: ["honda"] }, { name: "Nissan", aliases: ["nissan"] }, { name: "Mazda", aliases: ["mazda"] }, { name: "Hyundai", aliases: ["hyundai"] }, { name: "Kia", aliases: ["kia"] }, { name: "Tesla", aliases: ["tesla"] }, { name: "Volvo", aliases: ["volvo"] }, { name: "Fiat", aliases: ["fiat", "stellantis"] }, { name: "Alfa Romeo", aliases: ["alfa romeo"] }, { name: "Jeep", aliases: ["jeep"] }, { name: "Porsche", aliases: ["porsche", "vag"] }
    ],
    models: [
      { brand: "Peugeot", name: "208", aliases: ["208"], years: "2012-2026", variants: [{ engine: "1.2 PureTech", power: "82" }, { engine: "1.2 PureTech", power: "110" }, { engine: "1.2 PureTech", power: "130" }, { engine: "e-208", power: "136", type: "VE" }] },
      { brand: "Peugeot", name: "308", aliases: ["308"], years: "2007-2026", variants: [{ engine: "1.2 PureTech", power: "110" }, { engine: "1.2 PureTech", power: "130" }, { engine: "1.6 BlueHDi", power: "120" }, { engine: "2.0 BlueHDi", power: "150" }] },
      { brand: "Peugeot", name: "2008", aliases: ["2008"], years: "2013-2026", variants: [{ engine: "1.2 PureTech", power: "110" }, { engine: "1.2 PureTech", power: "130" }, { engine: "1.5 BlueHDi", power: "130" }] },
      { brand: "Peugeot", name: "3008", aliases: ["3008"], years: "2009-2026", variants: [{ engine: "1.2 PureTech", power: "130" }, { engine: "1.5 BlueHDi", power: "130" }, { engine: "2.0 BlueHDi", power: "180" }] },
      { brand: "Citroën", name: "C3", aliases: ["c3"], years: "2002-2026", variants: [{ engine: "1.2 PureTech", power: "82" }, { engine: "1.2 PureTech", power: "110" }] },
      { brand: "Citroën", name: "C4 Cactus", aliases: ["c4 cactus", "cactus"], years: "2014-2020", variants: [{ engine: "1.2 PureTech", power: "110" }, { engine: "1.6 BlueHDi", power: "100" }] },
      { brand: "Citroën", name: "C4", aliases: ["c4"], years: "2010-2026", variants: [{ engine: "1.2 PureTech", power: "130" }, { engine: "1.5 BlueHDi", power: "130" }] },
      { brand: "Volkswagen", name: "Golf", aliases: ["golf", "golf 7", "golf 8"], years: "1974-2026", variants: [{ engine: "1.0 TSI", power: "110" }, { engine: "1.5 TSI", power: "150" }, { engine: "2.0 TDI", power: "150" }, { engine: "e-Golf", power: "136", type: "VE" }] },
      { brand: "Volkswagen", name: "Tiguan", aliases: ["tiguan"], years: "2007-2026", variants: [{ engine: "1.5 TSI", power: "150" }, { engine: "2.0 TDI", power: "150" }, { engine: "2.0 TDI", power: "190" }] },
      { brand: "Ford", name: "Focus", aliases: ["focus"], years: "1998-2026", variants: [{ engine: "1.0 EcoBoost", power: "125" }, { engine: "1.5 EcoBlue", power: "120" }, { engine: "2.0 EcoBlue", power: "150" }] },
      { brand: "Ford", name: "Kuga", aliases: ["kuga"], years: "2008-2026", variants: [{ engine: "1.5 EcoBlue", power: "120" }, { engine: "2.0 EcoBlue", power: "150" }] },
      { brand: "Hyundai", name: "Kona", aliases: ["kona"], years: "2017-2026", variants: [{ engine: "1.0 T-GDi", power: "120" }, { engine: "Kona Electric", power: "136", type: "VE" }, { engine: "Kona Electric", power: "204", type: "VE" }] },
      { brand: "Tesla", name: "Model 3", aliases: ["model 3"], years: "2017-2026", variants: [{ engine: "Tesla LR", power: "283", type: "VE" }, { engine: "Tesla LR", power: "346", type: "VE" }] },
      { brand: "Tesla", name: "Model Y", aliases: ["model y"], years: "2020-2026", variants: [{ engine: "Tesla LR", power: "283", type: "VE" }, { engine: "Tesla LR", power: "346", type: "VE" }] },
      { brand: "Renault", name: "Clio", aliases: ["clio"], years: "1990-2026", variants: [{ engine: "1.0 TCe", power: "100" }, { engine: "1.5 Blue dCi", power: "115" }] },
      { brand: "Renault", name: "Megane", aliases: ["megane", "mégane"], years: "1995-2026", variants: [{ engine: "1.3 TCe", power: "140" }, { engine: "1.5 Blue dCi", power: "115" }] }
    ],
    engines: [
      { code: "EB2", names: ["1.2 puretech", "puretech", "eb2"], type: "Essence", knownIssues: ["Courroie humide", "Délamination", "Crépine colmatée"], brands: ["Peugeot", "Citroën", "DS", "Opel"] },
      { code: "1.5 EcoBlue", names: ["1.5 ecoblue", "ecoblue"], type: "Diesel", knownIssues: ["Courroie humide", "EGR", "FAP"], brands: ["Ford"] },
      { code: "2.0 EcoBlue", names: ["2.0 ecoblue"], type: "Diesel", knownIssues: ["Courroie humide", "EGR", "FAP"], brands: ["Ford"] },
      { code: "1.0 TSI", names: ["1.0 tsi", "tsi"], type: "Essence", knownIssues: ["Chaîne distribution", "Turbo"], brands: ["Volkswagen", "SEAT", "Škoda", "Audi"] },
      { code: "1.5 TSI", names: ["1.5 tsi"], type: "Essence", knownIssues: ["Injection", "Turbo"], brands: ["Volkswagen", "SEAT", "Škoda", "Audi"] },
      { code: "2.0 TDI", names: ["2.0 tdi", "tdi"], type: "Diesel", knownIssues: ["EGR", "FAP", "Injecteurs"], brands: ["Volkswagen", "SEAT", "Škoda", "Audi"] },
      { code: "1.5 BlueHDi", names: ["1.5 bluehdi", "bluehdi"], type: "Diesel", knownIssues: ["EGR", "FAP", "AdBlue"], brands: ["Peugeot", "Citroën", "DS", "Opel"] },
      { code: "2.0 BlueHDi", names: ["2.0 bluehdi"], type: "Diesel", knownIssues: ["EGR", "FAP", "AdBlue", "Turbo"], brands: ["Peugeot", "Citroën", "DS", "Opel"] },
      { code: "1.0 EcoBoost", names: ["1.0 ecoboost", "ecoboost"], type: "Essence", knownIssues: ["Refroidissement", "Turbo"], brands: ["Ford"] },
      { code: "1.5 Blue dCi", names: ["1.5 dci", "blue dci"], type: "Diesel", knownIssues: ["EGR", "FAP", "Injecteurs"], brands: ["Renault", "Dacia"] },
      { code: "1.3 TCe", names: ["1.3 tce", "tce"], type: "Essence", knownIssues: ["Injection", "Turbo"], brands: ["Renault", "Dacia"] },
      { code: "Kona Electric", names: ["kona electric", "kona ev"], type: "Électrique", knownIssues: ["Batterie", "OBC", "Charge"], brands: ["Hyundai"] },
      { code: "e-208", names: ["e-208", "e208"], type: "Électrique", knownIssues: ["Batterie", "Charge"], brands: ["Peugeot"] },
      { code: "Tesla LR", names: ["long range", "standard range"], type: "Électrique", knownIssues: ["Batterie", "Charge"], brands: ["Tesla"] }
    ],
    correlations: [
      { brand: "Peugeot", model: "308", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination de la courroie immergée dans l'huile moteur EB2." },
      { brand: "Peugeot", model: "308", engine: "1.2 PureTech", failure: "Crépine colmatée", probability: 8, severity: "Critique", system: "lubrification", description: "Obstruction crépine par débris de courroie." },
      { brand: "Peugeot", model: "208", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Peugeot", model: "2008", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Peugeot", model: "3008", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Citroën", model: "C3", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Citroën", model: "C4 Cactus", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 9, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Citroën", model: "C4", engine: "1.2 PureTech", failure: "Courroie humide délaminée", probability: 8, severity: "Critique", system: "distribution", description: "Délamination courroie EB2." },
      { brand: "Ford", model: "Focus", engine: "1.5 EcoBlue", failure: "Courroie humide délaminée", probability: 8, severity: "Critique", system: "distribution", description: "Délamination courroie EcoBlue." },
      { brand: "Ford", model: "Kuga", engine: "1.5 EcoBlue", failure: "Courroie humide délaminée", probability: 8, severity: "Critique", system: "distribution", description: "Délamination courroie EcoBlue." },
      { brand: "Volkswagen", model: "Golf", engine: "1.5 TSI", failure: "Injecteurs défectueux", probability: 6, severity: "Élevé", system: "injection", description: "Défaut injecteurs TSI." },
      { brand: "Volkswagen", model: "Golf", engine: "2.0 TDI", failure: "EGR encrassée", probability: 7, severity: "Élevé", system: "egr", description: "Encrassement vanne EGR TDI." },
      { brand: "Volkswagen", model: "Tiguan", engine: "2.0 TDI", failure: "FAP colmaté", probability: 7, severity: "Élevé", system: "echappement", description: "Colmatage FAP TDI." },
      { brand: "Hyundai", model: "Kona", engine: "Kona Electric", failure: "Runaway batterie HT", probability: 5, severity: "Critique", system: "ht", description: "Emballement thermique batterie." },
      { brand: "Tesla", model: "Model 3", engine: "Tesla LR", failure: "Runaway batterie HT", probability: 4, severity: "Critique", system: "ht", description: "Emballement thermique batterie." },
      { brand: "Tesla", model: "Model Y", engine: "Tesla LR", failure: "Runaway batterie HT", probability: 4, severity: "Critique", system: "ht", description: "Emballement thermique batterie." },
      { brand: "Renault", model: "Clio", engine: "1.5 Blue dCi", failure: "EGR encrassée", probability: 6, severity: "Modéré", system: "egr", description: "Encrassement vanne EGR dCi." },
      { brand: "Renault", model: "Megane", engine: "1.3 TCe", failure: "Turbo défectueux", probability: 5, severity: "Élevé", system: "turbo", description: "Défaut turbo TCe." },
      { brand: "Peugeot", model: "308", engine: "1.6 BlueHDi", failure: "FAP colmaté", probability: 7, severity: "Élevé", system: "echappement", description: "Colmatage FAP BlueHDi." },
      { brand: "Peugeot", model: "3008", engine: "2.0 BlueHDi", failure: "AdBlue / SCR défaut", probability: 6, severity: "Modéré", system: "adblue", description: "Cristallisation urée / défaut SCR." }
    ]
  };

  var brands = EMBED.brands.slice(), models = EMBED.models.slice(), engines = EMBED.engines.slice(), correlations = EMBED.correlations.slice();

  function dedupeModels(list) { var seen = {}, out = []; list.forEach(function (m) { if (!m || !m.name) return; var k = norm(m.brand) + "|" + norm(m.name); if (seen[k]) { var cur = out[seen[k] - 1]; cur.variants = uniqVariants((cur.variants || []).concat(m.variants || [])); if (m.years) cur.years = m.years; (m.aliases || []).forEach(function (a) { if (cur.aliases.indexOf(a) < 0) cur.aliases.push(a); }); } else { seen[k] = out.push(JSON.parse(JSON.stringify(m))); } }); return out; }
  function uniqVariants(v) { var seen = {}, out = []; (v || []).forEach(function (x) { if (!x) return; var k = norm(x.engine) + "|" + (x.power || ""); if (!seen[k]) { seen[k] = 1; out.push(x); } }); return out; }
  function dedupeEngines(list) { var seen = {}, out = []; list.forEach(function (e) { if (!e || !e.code) return; var k = norm(e.code); if (seen[k]) { var cur = out[seen[k] - 1]; cur.names = uniq((cur.names || []).concat(e.names || [])); cur.knownIssues = uniq((cur.knownIssues || []).concat(e.knownIssues || [])); } else out.push(JSON.parse(JSON.stringify(e))); }); return out; }
  function dedupeCorr(list) { var seen = {}, out = []; list.forEach(function (c) { if (!c || !c.failure) return; var k = norm(c.brand) + "|" + norm(c.model) + "|" + norm(c.failure); if (!seen[k]) { seen[k] = 1; out.push(JSON.parse(JSON.stringify(c))); } }); return out; }
  function dedupeBrands(list) { var seen = {}, out = []; list.forEach(function (b) { if (!b || !b.name) return; var k = norm(b.name); if (!seen[k]) { seen[k] = 1; out.push(JSON.parse(JSON.stringify(b))); } }); return out; }

  function applyData(j) {
    if (!j) return;
    if (Array.isArray(j.brands)) brands = dedupeBrands(brands.concat(j.brands));
    if (Array.isArray(j.models)) models = dedupeModels(models.concat(j.models));
    if (Array.isArray(j.engines)) engines = dedupeEngines(engines.concat(j.engines));
    if (Array.isArray(j.correlations)) correlations = dedupeCorr(correlations.concat(j.correlations));
    publishCounts();
  }
  function publishCounts() {
    if (!EIK) return;
    EIK.predictorVersion = VERSION;
    EIK.vehicleCount = models.length;
    EIK.engineCount = engines.length;
    EIK.corrCount = correlations.length;
    EIK.setCheck("pred", "Moteur prédictif", "ok", VERSION + " · " + brands.length + " marques · " + models.length + " modèles · " + correlations.length + " corr.");
  }
  function loadRemote() {
    var jobs = [
      fetch("data/vehicles.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("data/engines.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch("data/correlations.json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ];
    return Promise.all(jobs).then(function (res) { res.forEach(function (j) { if (j) applyData(j); }); publishCounts(); return true; });
  }

  function inferVehicle(query) {
    var q = norm(query);
    var powerMatch = query.match(/(\d{2,3})\s*(?:ch|hp|cv)\b/i);
    var power = powerMatch ? powerMatch[1] : null;
    var detectedBrand = null, detectedModel = null, detectedEngine = null, detectedPower = power;
    brands.forEach(function (b) { var bn = norm(b.name); if (bn.length > 1 && q.indexOf(bn) >= 0) detectedBrand = b.name; (b.aliases || []).forEach(function (a) { var an = norm(a); if (an.length > 2 && q.indexOf(an) >= 0) detectedBrand = b.name; }); });
    models.forEach(function (m) { var mn = norm(m.name); var hit = mn.length > 1 && q.indexOf(mn) >= 0; (m.aliases || []).forEach(function (a) { var an = norm(a); if (an.length > 1 && q.indexOf(an) >= 0) hit = true; }); if (hit && (!detectedBrand || detectedBrand === m.brand)) { detectedModel = m; detectedBrand = m.brand; } });
    engines.forEach(function (e) { var en = norm(e.code); if (en.length > 2 && q.indexOf(en) >= 0) detectedEngine = e; (e.names || []).forEach(function (n) { var nn = norm(n); if (nn.length > 3 && q.indexOf(nn) >= 0) detectedEngine = e; }); });
    if (!detectedEngine && detectedModel) { var vm = norm(query); (detectedModel.variants || []).forEach(function (v) { if (v.engine && vm.indexOf(norm(v.engine)) >= 0) { detectedEngine = { code: v.engine }; if (v.power) detectedPower = detectedPower || v.power; } }); }
    if (detectedModel) { var best = null; (detectedModel.variants || []).forEach(function (v) { if (detectedPower && String(v.power) === String(detectedPower)) best = v; else if (!best && (!detectedEngine || norm(v.engine) === norm(detectedEngine.code))) best = v; }); if (best) { detectedEngine = detectedEngine || { code: best.engine }; detectedPower = detectedPower || best.power; } }
    if (!detectedBrand && !detectedModel && !detectedEngine) return null;
    return { brand: detectedBrand, model: detectedModel ? detectedModel.name : null, engine: detectedEngine ? detectedEngine.code : null, power: detectedPower, years: detectedModel ? (detectedModel.years || "") : "", confidence: (detectedBrand && detectedModel && detectedEngine) ? "Élevé" : (detectedModel || detectedEngine) ? "Moyen" : "Partiel" };
  }
  function findCorrelations(vehicle) {
    if (!vehicle) return [];
    var b = norm(vehicle.brand || ""), m = norm(vehicle.model || ""), e = norm(vehicle.engine || "");
    var out = [];
    correlations.forEach(function (c) {
      var score = 0, cb = norm(c.brand || ""), cm = norm(c.model || ""), ce = norm(c.engine || "");
      if (b && cb && (b === cb || b.indexOf(cb) >= 0 || cb.indexOf(b) >= 0)) score += 40;
      if (m && cm && (m === cm || m.indexOf(cm) >= 0 || cm.indexOf(m) >= 0)) score += 50;
      if (e && ce && (e === ce || e.indexOf(ce) >= 0 || ce.indexOf(e) >= 0)) score += 60;
      if (score > 0) out.push({ failure: c.failure, probability: c.probability || Math.round(score / 15), severity: c.severity || "Élevé", system: c.system || "generic", description: c.description || "", score: score });
    });
    return out.sort(function (x, y) { return y.score - x.score; }).slice(0, 20);
  }
  function analyzePredictive(query) { var vehicle = inferVehicle(query); return { vehicle: vehicle, correlations: vehicle ? findCorrelations(vehicle) : [], confidence: vehicle ? vehicle.confidence : "Aucun véhicule détecté", query: query }; }
  function getStats() { return { brands: brands.length, models: models.length, engines: engines.length, correlations: correlations.length }; }

  publishCounts();
  var ready = loadRemote();

  return { version: VERSION, ready: ready, inferVehicle: inferVehicle, findCorrelations: findCorrelations, analyzePredictive: analyzePredictive, getStats: getStats, getBrands: function () { return brands.slice(); }, getModels: function () { return models.slice(); }, getEngines: function () { return engines.slice(); }, getCorrelations: function () { return correlations.slice(); } };
})();
