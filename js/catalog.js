/* CATALOGUE MASSIF — expansion, index inversé, fusion, persistance IndexedDB, recherche. */
window.EIK_CATALOG = (function () {
  "use strict";
  var VERSION = "47.0.0", EIK = window.EIK, W = window, D = document;
  var DB = "eik-catalog-mass", STORE = "kv";
  var brands = [], models = [], engines = [], correlations = [];
  var idxBrand = {}, idxModel = {}, idxEngine = {}, idxPower = {}, idxToken = {}, triIndex = {};
  var dbp = null, dirty = false, saveTimer = null;

  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9.+#\- ]/g, " ").replace(/\s+/g, " ").trim(); }
  function key(s) { return norm(s).replace(/[^a-z0-9]/g, ""); }
  function uniq(a) { var o = {}, r = []; (a || []).forEach(function (x) { if (x != null && x !== "" && !o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function push(map, k, id) { if (!k) return; (map[k] = map[k] || []).push(id); }
  function trigrams(s) { var t = [], n = "  " + key(s) + " "; for (var i = 0; i < n.length - 2; i++) t.push(n.slice(i, i + 3)); return t; }

  /* ---- expansion du format compact ---- */
  function expandLines(lines) {
    var out = { brands: [], models: [], engines: [], correlations: [] };
    var bset = {}, eset = {};
    (lines || []).forEach(function (line) {
      if (typeof line !== "string") return;
      var p = line.split("|");
      if (p.length < 2) return;
      var brand = (p[0] || "").trim(), name = (p[1] || "").trim(), years = (p[2] || "").trim(), spec = (p[3] || "").trim();
      if (!brand || !name) return;
      if (!bset[key(brand)]) { bset[key(brand)] = 1; out.brands.push({ name: brand, aliases: [] }); }
      var variants = [];
      spec.split(";").forEach(function (chunk) {
        chunk = chunk.trim(); if (!chunk) return;
        var eq = chunk.indexOf("=");
        var eng = eq >= 0 ? chunk.slice(0, eq).trim() : chunk.trim();
        var powers = eq >= 0 ? chunk.slice(eq + 1) : "";
        if (!eng) return;
        var plist = powers.split("/").map(function (x) { return x.replace(/[^0-9]/g, ""); }).filter(Boolean);
        if (!plist.length) plist = [""];
        plist.forEach(function (pw) { variants.push({ engine: eng, power: pw, type: guessType(eng) }); });
        var ek = key(eng);
        if (!eset[ek]) { eset[ek] = 1; out.engines.push({ code: eng, names: [eng], type: guessType(eng), knownIssues: [], brands: [brand] }); }
        else { var e = out.engines.find(function (x) { return key(x.code) === ek; }); if (e && e.brands.indexOf(brand) < 0) e.brands.push(brand); }
      });
      out.models.push({ brand: brand, name: name, aliases: autoAliases(brand, name), years: years, variants: variants });
    });
    return out;
  }
  function guessType(eng) {
    var e = norm(eng);
    if (/electric|e-tech|e-tron|ev|electric|ze |z\.e|id\.|eq|ioniq|kona electric|leaf|tesla|polestar|born|taycan|e-208|e-2008|e-c4|e-berlingo|e-jumpy|e-doblo|e-ducato|e-transit|e-crafter|e-up|e-golf|e-nv200|e-niro|e-soul|e-golf|mach-e|bolt|rivian|lucid|zeekr|nio|xpeng|byd|ora|aiways|seres|leapmotor|vinfast|smart #|polestar|folgore|spectre|eletre|emira|ev6|ev9|ev3|ariya|bz4x|solterra|rz|ux300e|mirai|nexo|hydrog/.test(e)) return "Électrique";
    if (/hybrid|phev|e-hybrid|e-tense|recharge|twin engine|e-power|e:hev|dm-i|erev|gte|gte|4xe|hybrid4|i-performance|e-flex/.test(e)) return "Hybride";
    if (/tdi|hdi|bluehdi|dci|cdti|crdi|jtd|multijet|d-4d|diesel|tdci|ecoblue|skyactiv-d|di-d|dci|cdi|d4d|ddis|dtec|idtec|crd|tdv|sdv|dci|bluetec|cdi|dCi/.test(e)) return "Diesel";
    if (/gpl|lpg|eco-g|bifuel|cng|tgi|g-tron/.test(e)) return "GPL/GNV";
    return "Essence";
  }
  function autoAliases(brand, name) {
    var a = [name, brand + " " + name, name.replace(/[\s\-]/g, "")];
    var n = norm(name);
    if (n.indexOf("serie ") === 0) a.push(n.replace("serie ", ""), "s" + n.replace("serie ", ""));
    if (n.indexOf("classe ") === 0) a.push(n.replace("classe ", ""));
    if (n.indexOf("model ") === 0) a.push(n.replace("model ", ""));
    return uniq(a);
  }

  /* ---- fusion / dédoublonnage ---- */
  function mergeBrands(list) {
    var map = {};
    brands.concat(list || []).forEach(function (b) {
      if (!b || !b.name) return; var k = key(b.name);
      if (!map[k]) map[k] = { name: b.name, aliases: [] };
      map[k].aliases = uniq((map[k].aliases || []).concat(b.aliases || []));
    });
    brands = Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.name.localeCompare(b.name, "fr"); });
  }
  function mergeModels(list) {
    var map = {};
    models.forEach(function (m) { map[key(m.brand) + "|" + key(m.name)] = clone(m); });
    (list || []).forEach(function (m) {
      if (!m || !m.name || !m.brand) return;
      var k = key(m.brand) + "|" + key(m.name);
      if (!map[k]) { map[k] = { brand: m.brand, name: m.name, aliases: autoAliases(m.brand, m.name), years: m.years || "", variants: [] }; }
      var cur = map[k];
      if (m.years && (!cur.years || m.years.length > cur.years.length)) cur.years = m.years;
      cur.aliases = uniq((cur.aliases || []).concat(m.aliases || [], autoAliases(m.brand, m.name)));
      var vs = {}; (cur.variants || []).forEach(function (v) { vs[key(v.engine) + "|" + (v.power || "")] = v; });
      (m.variants || []).forEach(function (v) {
        if (!v || !v.engine) return;
        var vk = key(v.engine) + "|" + (v.power || "");
        if (!vs[vk]) vs[vk] = { engine: v.engine, power: String(v.power || "").replace(/[^0-9]/g, ""), type: v.type || guessType(v.engine) };
      });
      cur.variants = Object.keys(vs).map(function (x) { return vs[x]; });
    });
    models = Object.keys(map).map(function (k) { return map[k]; });
  }
  function mergeEngines(list) {
    var map = {};
    engines.forEach(function (e) { map[key(e.code)] = clone(e); });
    (list || []).forEach(function (e) {
      if (!e || !e.code) return; var k = key(e.code);
      if (!map[k]) map[k] = { code: e.code, names: [], type: e.type || guessType(e.code), knownIssues: [], brands: [] };
      var cur = map[k];
      cur.names = uniq((cur.names || []).concat(e.names || [], [e.code]));
      cur.knownIssues = uniq((cur.knownIssues || []).concat(e.knownIssues || []));
      cur.brands = uniq((cur.brands || []).concat(e.brands || []));
      if (e.type) cur.type = e.type;
    });
    engines = Object.keys(map).map(function (k) { return map[k]; });
  }
  function mergeCorrelations(list) {
    var map = {};
    correlations.forEach(function (c) { map[key(c.brand) + "|" + key(c.model) + "|" + key(c.engine) + "|" + key(c.failure)] = clone(c); });
    (list || []).forEach(function (c) {
      if (!c || !c.failure) return;
      var k = key(c.brand) + "|" + key(c.model) + "|" + key(c.engine) + "|" + key(c.failure);
      if (!map[k]) map[k] = { brand: c.brand || "", model: c.model || "", engine: c.engine || "", failure: c.failure, probability: Number(c.probability) || 6, severity: c.severity || "Élevé", system: c.system || "generic", description: c.description || "" };
      else { var cur = map[k]; cur.probability = Math.max(cur.probability || 0, Number(c.probability) || 0); if (c.description && c.description.length > (cur.description || "").length) cur.description = c.description; }
    });
    correlations = Object.keys(map).map(function (k) { return map[k]; });
  }
  function mergeCatalog(cat) {
    if (!cat) return stats();
    mergeBrands(cat.brands); mergeModels(cat.models); mergeEngines(cat.engines); mergeCorrelations(cat.correlations);
    buildIndex(); scheduleSave(); publish(); return stats();
  }

  /* ---- index inversé + trigrammes ---- */
  function buildIndex() {
    idxBrand = {}; idxModel = {}; idxEngine = {}; idxPower = {}; idxToken = {}; triIndex = {};
    brands.forEach(function (b) { push(idxBrand, key(b.name), b.name); (b.aliases || []).forEach(function (a) { push(idxBrand, key(a), b.name); }); });
    models.forEach(function (m, i) {
      var id = i;
      push(idxModel, key(m.name), id); push(idxModel, key(m.brand + " " + m.name), id);
      (m.aliases || []).forEach(function (a) { push(idxModel, key(a), id); });
      push(idxBrand, key(m.brand), id);
      var toks = norm(m.brand + " " + m.name + " " + (m.aliases || []).join(" ")).split(" ").filter(Boolean);
      (m.variants || []).forEach(function (v) {
        push(idxEngine, key(v.engine), id);
        if (v.power) push(idxPower, v.power, id);
        toks = toks.concat(norm(v.engine).split(" ").filter(Boolean));
        if (v.power) toks.push(v.power);
      });
      uniq(toks).forEach(function (t) { push(idxToken, t, id); trigrams(t).forEach(function (g) { push(triIndex, g, id); }); });
      trigrams(m.name).forEach(function (g) { push(triIndex, g, id); });
    });
    engines.forEach(function (e) { push(idxEngine, key(e.code), -1); (e.names || []).forEach(function (n) { push(idxEngine, key(n), -1); }); });
  }

  /* ---- persistance ---- */
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!W.indexedDB) return rej(new Error("IndexedDB indisponible"));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function (e) { var d = e.target.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  async function idbSet(k, v) { var d = await idb(); return new Promise(function (res, rej) { var t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; }); }
  async function idbGet(k) { var d = await idb(); return new Promise(function (res, rej) { var t = d.transaction(STORE, "readonly"), q = t.objectStore(STORE).get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }
  function scheduleSave() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); }
  async function save() {
    if (!dirty) return; dirty = false;
    var payload = { brands: brands, models: models, engines: engines, correlations: correlations, ts: Date.now(), version: VERSION };
    try { await idbSet("catalog", payload); } catch (e) {}
    try { localStorage.setItem("eik-catalog-meta", JSON.stringify({ ts: payload.ts, brands: brands.length, models: models.length, engines: engines.length, powers: stats().powers, correlations: correlations.length })); } catch (e) {}
  }
  async function loadLocal() {
    try { var c = await idbGet("catalog"); if (c && c.models && c.models.length) { mergeCatalog(c); return true; } } catch (e) {}
    return false;
  }
  async function loadEmbedded() {
    try {
      var r = await fetch("data/catalog-massif.json?v=" + VERSION, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      var j = await r.json();
      var exp = expandLines(j.lines || []);
      mergeCatalog(exp);
      if (EIK) EIK.setCheck("catalogFile", "Catalogue massif embarqué", "ok", (j.lines || []).length + " lignes expandues");
      return true;
    } catch (e) {
      if (EIK) EIK.setCheck("catalogFile", "Catalogue massif embarqué", "warn", "Fichier absent — catalogue de secours actif");
      mergeCatalog(expandLines(FALLBACK_LINES));
      return false;
    }
  }
  async function loadRemote() {
    var jobs = ["vehicles", "engines", "correlations"].map(function (n) {
      return fetch("data/" + n + ".json?v=" + VERSION, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    });
    var res = await Promise.all(jobs), cat = { brands: [], models: [], engines: [], correlations: [] };
    res.forEach(function (j) { if (!j) return; ["brands", "models", "engines", "correlations"].forEach(function (k) { if (Array.isArray(j[k])) cat[k] = cat[k].concat(j[k]); }); });
    mergeCatalog(cat);
  }

  /* ---- recherche massive ---- */
  function searchVehicles(q, limit) {
    var nq = norm(q); if (!nq) return [];
    var toks = nq.split(" ").filter(function (t) { return t.length > 1; });
    var scores = {}, powerTok = null;
    var pm = String(q).match(/(\d{2,4})\s*(?:ch|hp|cv|ps|kw)?\b/i);
    if (pm) powerTok = pm[1];
    toks.forEach(function (t) {
      var k = key(t);
      (idxBrand[k] || []).forEach(function (id) { if (typeof id === "number") scores[id] = (scores[id] || 0) + 30; });
      (idxModel[k] || []).forEach(function (id) { scores[id] = (scores[id] || 0) + 45; });
      (idxEngine[k] || []).forEach(function (id) { if (id >= 0) scores[id] = (scores[id] || 0) + 35; });
      (idxToken[t] || []).forEach(function (id) { scores[id] = (scores[id] || 0) + 12; });
      if (idxPower[t]) (idxPower[t] || []).forEach(function (id) { scores[id] = (scores[id] || 0) + 20; });
      if (k.length > 3) {
        Object.keys(idxModel).forEach(function (mk) { if (mk.indexOf(k) >= 0) (idxModel[mk] || []).forEach(function (id) { scores[id] = (scores[id] || 0) + 18; }); });
        Object.keys(idxEngine).forEach(function (ek) { if (ek.indexOf(k) >= 0) (idxEngine[ek] || []).forEach(function (id) { if (id >= 0) scores[id] = (scores[id] || 0) + 14; }); });
      }
    });
    if (powerTok && idxPower[powerTok]) idxPower[powerTok].forEach(function (id) { scores[id] = (scores[id] || 0) + 25; });
    if (!Object.keys(scores).length) {
      var gs = {}; toks.forEach(function (t) { trigrams(t).forEach(function (g) { (triIndex[g] || []).forEach(function (id) { gs[id] = (gs[id] || 0) + 1; }); }); });
      Object.keys(gs).forEach(function (id) { if (gs[id] >= 2) scores[id] = gs[id] * 3; });
    }
    var out = Object.keys(scores).map(function (id) { return { m: models[+id], sc: scores[id] }; }).filter(function (x) { return x.m; });
    out.sort(function (a, b) { return b.sc - a.sc || a.m.name.localeCompare(b.m.name, "fr"); });
    return out.slice(0, limit || 120).map(function (x) { return { brand: x.m.brand, model: x.m.name, years: x.m.years, variants: x.m.variants, score: x.sc }; });
  }
  function inferVehicle(query) {
    var hits = searchVehicles(query, 1);
    if (!hits.length) {
      var e = findEngine(query);
      if (e) return { brand: null, model: null, engine: e.code, power: extractPower(query), years: "", confidence: "Motorisation seule" };
      return null;
    }
    var m = hits[0], nq = norm(query), eng = null, pow = extractPower(query);
    (m.variants || []).forEach(function (v) {
      var ve = norm(v.engine);
      if (nq.indexOf(ve) >= 0 && (!pow || String(v.power) === String(pow))) { eng = v.engine; if (v.power) pow = pow || v.power; }
    });
    if (!eng) { (m.variants || []).forEach(function (v) { if (!eng && (!pow || String(v.power) === String(pow))) { eng = v.engine; pow = pow || v.power; } }); }
    if (!eng && m.variants && m.variants.length) { eng = m.variants[0].engine; pow = pow || m.variants[0].power; }
    return { brand: m.brand, model: m.model, engine: eng, power: pow, years: m.years, confidence: (m.brand && m.model && eng) ? "Élevé" : "Moyen" };
  }
  function extractPower(q) { var m = String(q).match(/(\d{2,4})\s*(?:ch|hp|cv|ps)\b/i); if (m) return m[1]; var kw = String(q).match(/(\d{2,3})\s*kw\b/i); if (kw) return String(Math.round(parseInt(kw[1], 10) * 1.35962)); return null; }
  function findEngine(q) {
    var nq = key(q), best = null, bl = 0;
    engines.forEach(function (e) {
      var cands = [e.code].concat(e.names || []);
      cands.forEach(function (c) { var k = key(c); if (k.length > 2 && nq.indexOf(k) >= 0 && k.length > bl) { bl = k.length; best = e; } });
    });
    return best;
  }
  function findCorrelations(v) {
    if (!v) return [];
    var b = key(v.brand || ""), m = key(v.model || ""), e = key(v.engine || ""), out = [];
    correlations.forEach(function (c) {
      var sc = 0, cb = key(c.brand || ""), cm = key(c.model || ""), ce = key(c.engine || "");
      if (b && cb && (b === cb || b.indexOf(cb) >= 0 || cb.indexOf(b) >= 0)) sc += 40;
      if (m && cm && (m === cm || m.indexOf(cm) >= 0 || cm.indexOf(m) >= 0)) sc += 50;
      if (e && ce && (e === ce || e.indexOf(ce) >= 0 || ce.indexOf(e) >= 0)) sc += 60;
      if (sc > 0) out.push({ failure: c.failure, probability: c.probability || Math.round(sc / 15), severity: c.severity || "Élevé", system: c.system || "generic", description: c.description || "", score: sc, brand: c.brand, model: c.model, engine: c.engine });
    });
    return out.sort(function (x, y) { return y.score - x.score; }).slice(0, 40);
  }
  function enginesFor(brand, model) {
    var out = [];
    if (model) { var m = models.find(function (x) { return key(x.name) === key(model) && (!brand || key(x.brand) === key(brand)); }); if (m) out = (m.variants || []).map(function (v) { return v.engine; }); }
    if (!out.length && brand) out = engines.filter(function (e) { return (e.brands || []).some(function (b) { return key(b) === key(brand); }); }).map(function (e) { return e.code; });
    if (!out.length) out = engines.map(function (e) { return e.code; });
    return uniq(out).sort(function (a, b) { return a.localeCompare(b, "fr"); });
  }
  function powersFor(brand, model, engine) {
    var out = [];
    models.forEach(function (m) {
      if (brand && key(m.brand) !== key(brand)) return;
      if (model && key(m.name) !== key(model)) return;
      (m.variants || []).forEach(function (v) { if (engine && key(v.engine) !== key(engine)) return; if (v.power) out.push(String(v.power)); });
    });
    return uniq(out).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });
  }
  function modelsFor(brand) { return models.filter(function (m) { return !brand || key(m.brand) === key(brand); }); }
  function stats() {
    var pw = {}, en = {};
    models.forEach(function (m) { (m.variants || []).forEach(function (v) { en[key(v.engine)] = 1; if (v.power) pw[key(m.brand) + "|" + key(m.name) + "|" + key(v.engine) + "|" + v.power] = 1; }); });
    engines.forEach(function (e) { en[key(e.code)] = 1; });
    return { brands: brands.length, models: models.length, engines: Object.keys(en).length, powers: Object.keys(pw).length, variants: models.reduce(function (a, m) { return a + (m.variants || []).length; }, 0), correlations: correlations.length };
  }
  function publish() {
    var s = stats();
    if (EIK) { EIK.catalogStats = s; EIK.vehicleCount = s.models; EIK.engineCount = s.engines; EIK.powerCount = s.powers; EIK.corrCount = s.correlations; EIK.setCheck("catalog", "Catalogue massif", "ok", s.brands + " marques · " + s.models + " modèles · " + s.engines + " motorisations · " + s.powers + " puissances"); }
    try { W.dispatchEvent(new CustomEvent("eik-catalog", { detail: s })); } catch (e) {}
  }
  function exportCatalog() { return { brands: clone(brands), models: clone(models), engines: clone(engines), correlations: clone(correlations) }; }
  function reset() { brands = []; models = []; engines = []; correlations = []; buildIndex(); scheduleSave(); publish(); }

  var FALLBACK_LINES = [
    "Peugeot|3008|2009-2026|1.2 PureTech=130;1.6 THP=165;1.5 BlueHDi=130;2.0 BlueHDi=180",
    "Peugeot|5008|2009-2026|1.6 THP=165;1.5 BlueHDi=130;2.0 BlueHDi=180",
    "Peugeot|308|2007-2026|1.2 PureTech=110/130;1.6 THP=155;1.6 BlueHDi=120",
    "Peugeot|208|2012-2026|1.2 PureTech=82/110;1.6 BlueHDi=100;e-208=136",
    "Citroën|C4 Cactus|2014-2020|1.2 PureTech=110;1.6 BlueHDi=100",
    "Renault|Megane|1995-2026|1.3 TCe=140;1.5 Blue dCi=115",
    "Volkswagen|Golf|1974-2026|1.5 TSI=150;2.0 TDI=150;2.0 TSI=245",
    "BMW|Série 3|1975-2026|N47=184;320d=190;330e=292",
    "Ford|Focus|1998-2026|1.0 EcoBoost=125;1.5 EcoBlue=120",
    "Tesla|Model 3|2017-2026|Long Range=346;Performance=513"
  ];

  var ready = (async function () {
    await loadLocal();
    await loadEmbedded();
    await loadRemote();
    buildIndex(); publish(); await save();
    return stats();
  })();

  return {
    version: VERSION, ready: ready, norm: norm, key: key, expandLines: expandLines, mergeCatalog: mergeCatalog,
    searchVehicles: searchVehicles, inferVehicle: inferVehicle, findCorrelations: findCorrelations, findEngine: findEngine,
    enginesFor: enginesFor, powersFor: powersFor, modelsFor: modelsFor, stats: stats, exportCatalog: exportCatalog,
    getBrands: function () { return clone(brands); }, getModels: function () { return clone(models); },
    getEngines: function () { return clone(engines); }, getCorrelations: function () { return clone(correlations); },
    save: save, reset: reset, guessType: guessType, buildIndex: buildIndex
  };
})();
