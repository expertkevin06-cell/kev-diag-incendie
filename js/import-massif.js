/* IMPORT MASSIF — extraction multi-stratégies depuis TechKevin 2026 + Auto-Diagnostic.
   Stratégies : JSON direct, tables HTML, bundles JS, rendu SPA iframe same-origin,
   lecture localStorage/sessionStorage/IndexedDB de l'iframe, regex moteur/puissance. */
window.EIK_IMPORT = (function () {
  "use strict";
  var VERSION = "47.0.0", EIK = window.EIK, CAT = window.EIK_CATALOG, W = window, D = document;
  var DB = "eik-import-mass", STORE = "kv", MAXTEXT = 6000000, TIMEOUT = 16000;
  var sources = [], imported = {}, meta = {}, busy = false, dbp = null;
  var DEFAULT = [
    { id: "techkevin2026", name: "TechKevin 2026 — Véhicules", url: "https://expertkevin06-cell.github.io/techkevin2026/#/veh", enabled: true, deep: true, probes: ["data/veh.json", "data/vehicles.json", "data/catalog.json", "data/marques.json", "data/modeles.json", "data/motorisations.json", "data/pannes.json", "data/db.json", "data/data.json", "assets/data.json", "assets/vehicles.json", "manifest.json", "asset-manifest.json"] },
    { id: "auto-diagnostic", name: "Auto-Diagnostic", url: "https://expertkevin06-cell.github.io/auto-diagnostic/", enabled: true, deep: true, probes: ["data/pannes.json", "data/diagnostics.json", "data/dtc.json", "data/vehicles.json", "data/catalog.json", "data/marques.json", "data/modeles.json", "data/motorisations.json", "data/db.json", "data/data.json", "assets/data.json", "manifest.json", "asset-manifest.json"] }
  ];
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function key(s) { return norm(s).replace(/[^a-z0-9]/g, ""); }
  function hash(s) { var h = 5381, i = s.length; while (i) h = (h * 33) ^ s.charCodeAt(--i); return (h >>> 0).toString(36); }
  function uniq(a) { var o = {}, r = []; (a || []).forEach(function (x) { x = String(x == null ? "" : x).trim(); if (x && !o[x]) { o[x] = 1; r.push(x); } }); return r; }
  function toList(v, sep) { if (Array.isArray(v)) return uniq(v.map(function (x) { return typeof x === "object" ? (x.label || x.title || x.name || x.text || x.code || "") : String(x); })); if (v == null) return []; return uniq(String(v).split(sep || /[\n;|]+/).map(function (s) { return s.trim(); })); }
  function pick(o, keys) { if (!o || typeof o !== "object") return undefined; var m = {}; Object.keys(o).forEach(function (k) { m[key(k)] = o[k]; }); for (var i = 0; i < keys.length; i++) { var k = key(keys[i]); if (m[k] != null && m[k] !== "") return m[k]; } return undefined; }
  function emit() { try { W.dispatchEvent(new CustomEvent("eik-import-changed", { detail: { count: all().length } })); } catch (e) {} }
  function prog(id, m, l) { try { W.dispatchEvent(new CustomEvent("eik-import-progress", { detail: { sourceId: id, message: m, level: l || "info", ts: Date.now() } })); } catch (e) {} }
  function idb() { if (dbp) return dbp; dbp = new Promise(function (res, rej) { if (!W.indexedDB) return rej(new Error("IDB")); var r = indexedDB.open(DB, 1); r.onupgradeneeded = function (e) { var d = e.target.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); return dbp; }
  async function set(k, v) { var d = await idb(); return new Promise(function (res, rej) { var t = d.transaction(STORE, "readwrite"); t.objectStore(STORE).put(v, k); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; }); }
  async function get(k) { var d = await idb(); return new Promise(function (res, rej) { var t = d.transaction(STORE, "readonly"), q = t.objectStore(STORE).get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }
  async function persist() { try { await set("imported", imported); await set("meta", meta); await set("sources", sources); } catch (e) {} try { localStorage.setItem("eik-import-meta", JSON.stringify(meta)); localStorage.setItem("eik-import-sources", JSON.stringify(sources)); } catch (e) {} }
  function all() { var o = []; Object.keys(imported).forEach(function (k) { o = o.concat(imported[k] || []); }); return o; }
  function stats() { return sources.map(function (s) { var m = meta[s.id] || {}; return { id: s.id, name: s.name, url: s.url, enabled: s.enabled !== false, count: (imported[s.id] || []).length, cat: m.cat || 0, last: m.last || null, status: m.status || "idle", message: m.message || "" }; }); }
  async function fetchText(u, t) { var c = new AbortController(), to = setTimeout(function () { c.abort(); }, t || TIMEOUT); try { var r = await fetch(u, { cache: "no-store", credentials: "omit", signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); var x = await r.text(); return x.length > MAXTEXT ? x.slice(0, MAXTEXT) : x; } finally { clearTimeout(to); } }
  function stripHash(u) { try { var x = new URL(u); x.hash = ""; return x.href; } catch (e) { return u; } }
  function abs(u, b) { try { return new URL(u, b).href; } catch (e) { return ""; } }
  function sameOrigin(u) { try { return new URL(u).origin === location.origin; } catch (e) { return false; } }
  function balanced(t, s) { var o = t[s], c = o === "[" ? "]" : "}", d = 0, q = false, e = false, ch = ""; for (var i = s; i < t.length && i - s < MAXTEXT; i++) { var x = t[i]; if (q) { if (e) e = false; else if (x === "\\") e = true; else if (x === ch) q = false; continue; } if (x === '"' || x === "'" || x === "`") { q = true; ch = x; continue; } if (x === o) d++; else if (x === c) { d--; if (!d) return t.slice(s, i + 1); } } return null; }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function isVehicle(o) { if (!o || typeof o !== "object" || Array.isArray(o)) return false; if (o.start_url || o.icons || o.short_name || o.display) return false; var k = Object.keys(o).map(norm).join(" "); return /marque|brand|make|constructeur/.test(k) && /modele|model|nom|name|vehicule|vehicle/.test(k); }
  function isEngineObj(o) { if (!o || typeof o !== "object" || Array.isArray(o)) return false; var k = Object.keys(o).map(norm).join(" "); return /motorisation|moteur|engine|code/.test(k) && /puissance|power|ch|cv|kw|type|energie|carburant|names|alias/.test(k); }
  function isFailure(o) { if (!o || typeof o !== "object" || Array.isArray(o)) return false; if (o.start_url || o.icons || o.short_name) return false; var k = Object.keys(o).map(norm).join(" "); return /titre|title|panne|failure|cause|symptom|symptome|diagnostic|dtc|mecanisme|mechanism|origine|origin/.test(k); }
  function walk(n, d, veh, eng, fail) {
    if (!n || d > 6 || veh.length + eng.length + fail.length > 20000) return;
    if (Array.isArray(n)) { n.forEach(function (x) { if (isVehicle(x)) veh.push(x); else if (isEngineObj(x)) eng.push(x); else if (isFailure(x)) fail.push(x); else if (typeof x === "object") walk(x, d + 1, veh, eng, fail); }); return; }
    if (typeof n === "object") { if (isVehicle(n)) veh.push(n); else if (isEngineObj(n)) eng.push(n); else if (isFailure(n)) fail.push(n); Object.keys(n).forEach(function (k) { var v = n[k]; if (v && typeof v === "object") walk(v, d + 1, veh, eng, fail); }); }
  }
  function candidates(t) {
    var veh = [], eng = [], fail = [], seen = {}, n = 0;
    function add(i) { if (n++ > 400) return; var s = balanced(t, i); if (!s || s.length < 30 || seen[s.length + ":" + i]) return; seen[s.length + ":" + i] = 1; var j = parse(s); if (j) walk(j, 0, veh, eng, fail); }
    var tr = t.trim(); if (tr[0] === "[" || tr[0] === "{") { var w = parse(tr); if (w) walk(w, 0, veh, eng, fail); }
    var re = /(?:var|let|const)\s+[A-Za-z0-9_$]+\s*=\s*(?=[\[{])|(?:window|self|globalThis)\.[A-Za-z0-9_$]+\s*=\s*(?=[\[{])|export\s+default\s+(?=[\[{])|"(?:vehicules|vehicles|veh|marques|brands|modeles|models|motorisations|engines|puissances|powers|pannes|failures|diagnostics|catalog|catalogue|data|db|items|records)"\s*:\s*(?=[\[{])/gi, m;
    while ((m = re.exec(t)) && n < 400) { var i = t.indexOf("[", m.index + m[0].length - 1), b = t.indexOf("{", m.index + m[0].length - 1), s = (i >= 0 && b >= 0) ? Math.min(i, b) : Math.max(i, b); if (s >= 0 && s - m.index < 240) add(s); }
    var kw = /marque|modele|motorisation|puissance|\d{2,3}\s*ch|puretech|bluehdi|ecoblue|tce|tdi|tsi|thp|n47|ea888/gi, k;
    while ((k = kw.exec(t)) && n < 400) { var bi = t.lastIndexOf("[", k.index), ci = t.lastIndexOf("{", k.index), st = Math.max(bi, ci); if (st >= 0 && k.index - st < 6000) add(st); }
    return { veh: veh, eng: eng, fail: fail };
  }
  function tables(html) {
    var veh = [], fail = [];
    try {
      var doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("table").forEach(function (tb) {
        var h = [].map.call(tb.querySelectorAll("thead th,tr:first-child th,tr:first-child td"), function (x) { return norm(x.textContent).trim(); });
        if (!h.length) return;
        tb.querySelectorAll("tbody tr,tr").forEach(function (tr, ri) {
          if (ri === 0 && !tb.querySelector("tbody")) return;
          var c = tr.querySelectorAll("td"); if (!c.length) return;
          var o = {}; c.forEach(function (td, i) { o[h[i] || ("col" + i)] = td.textContent.trim(); });
          if (isVehicle(o)) veh.push(o); else if (isFailure(o)) fail.push(o);
        });
      });
      doc.querySelectorAll("article,.card,[data-marque],[data-brand],[data-modele],li").forEach(function (el) {
        var txt = el.textContent || ""; if (txt.length < 12 || txt.length > 2000) return;
        var m = txt.match(/([A-ZÀ-Ý][A-Za-zÀ-ÿ\-]+)\s+([A-Z0-9À-Ý][A-Za-z0-9À-ÿ\- ]{1,24})\s*[–\-|·]?\s*(\d[.,]\d\s*[A-Za-z\-]{2,14}|\d{1,2}[.,]\d\s*TDI|\bEV\b|\bElectric\b)?\s*(\d{2,3})\s*(?:ch|cv|hp)/i);
        if (m) veh.push({ marque: m[1], modele: m[2].trim(), motorisation: (m[3] || "").trim(), puissance: m[4] });
      });
    } catch (e) {}
    return { veh: veh, fail: fail };
  }
  function regexPairs(t) {
    var veh = [], re = /([A-ZÀ-Ý][A-Za-zÀ-ÿ]{2,14})\s+([A-Z0-9][A-Za-z0-9\- ]{1,20}?)\s+(\d[.,]\d\s?(?:PureTech|BlueHDi|HDi|THP|TCe|TSI|TDI|TFSI|EcoBoost|EcoBlue|dCi|CDTi|CRDi|T-GDi|MultiJet|Skyactiv|VTEC|D-4D|TDI|TDci|MPI|TSi)?[A-Za-z\-]{0,12})\s+(\d{2,3})\s*(?:ch|cv|hp|ps)/gi, m, n = 0;
    while ((m = re.exec(t)) && n++ < 4000) veh.push({ marque: m[1], modele: m[2].trim(), motorisation: m[3].trim(), puissance: m[4] });
    var re2 = /(\d[.,]\d\s?(?:PureTech|BlueHDi|HDi|THP|TCe|TSI|TDI|TFSI|EcoBoost|EcoBlue|dCi|CRDi|T-GDi|MultiJet|Skyactiv|VTEC|D-4D))\s*[=:\-]?\s*(\d{2,3})\s*(?:ch|cv|hp|ps)/gi, m2, n2 = 0;
    while ((m2 = re2.exec(t)) && n2++ < 4000) veh.push({ motorisation: m2[1].trim(), puissance: m2[2] });
    return veh;
  }
  function normPower(v) {
    if (v == null) return "";
    var s = String(v).trim();
    var kw = s.match(/(\d{2,3})\s*kw/i); if (kw) return String(Math.round(parseInt(kw[1], 10) * 1.35962));
    var n = s.match(/(\d{2,4})/); return n ? n[1] : "";
  }
  function toCatalog(veh, eng) {
    var cat = { brands: [], models: [], engines: [], correlations: [] }, bset = {}, mset = {}, eset = {};
    (veh || []).forEach(function (o) {
      var brand = pick(o, ["marque", "brand", "make", "constructeur", "fabricant"]);
      var model = pick(o, ["modele", "model", "nom", "name", "vehicule", "vehicle", "libelle"]);
      var engine = pick(o, ["motorisation", "moteur", "engine", "code", "version", "finition"]);
      var power = normPower(pick(o, ["puissance", "power", "ch", "cv", "hp", "ps", "kw", "chevaux"]));
      var years = pick(o, ["annees", "years", "annee", "year", "periode"]) || "";
      var variantsRaw = pick(o, ["variants", "motorisations", "engines", "versions", "puissances", "powers"]);
      var vs = [];
      if (Array.isArray(variantsRaw)) variantsRaw.forEach(function (v) {
        if (typeof v === "object" && v) vs.push({ engine: String(pick(v, ["motorisation", "moteur", "engine", "code", "nom", "name"]) || ""), power: normPower(pick(v, ["puissance", "power", "ch", "cv", "hp", "kw"])), type: String(pick(v, ["type", "energie", "energy", "carburant"]) || "") });
        else { var s = String(v), pm = s.match(/(\d{2,3})/); vs.push({ engine: s.replace(/\d{2,3}\s*(ch|cv|hp|ps)?/i, "").trim(), power: pm ? pm[1] : "" }); }
      });
      if (engine) vs.push({ engine: String(engine), power: power, type: String(pick(o, ["type", "energie", "energy", "carburant"]) || "") });
      if (brand && model) {
        var bk = key(brand); if (!bset[bk]) { bset[bk] = 1; cat.brands.push({ name: String(brand), aliases: [] }); }
        var mk = bk + "|" + key(model);
        if (!mset[mk]) { mset[mk] = { brand: String(brand), name: String(model), aliases: [], years: String(years), variants: [] }; cat.models.push(mset[mk]); }
        var cur = mset[mk]; if (years && !cur.years) cur.years = String(years);
        vs.forEach(function (v) { if (v.engine) cur.variants.push(v); });
      } else if (engine && !model) {
        var ek = key(engine);
        if (!eset[ek]) { eset[ek] = { code: String(engine), names: [], type: String(pick(o, ["type", "energie", "carburant"]) || ""), knownIssues: toList(pick(o, ["pannes", "knownIssues", "defauts", "failures"]), /[,;|]+/), brands: brand ? [String(brand)] : [] }; cat.engines.push(eset[ek]); }
      }
      var fail = pick(o, ["panne", "failure", "defaut", "pannes", "knownIssues"]);
      if (brand && model && fail) toList(fail, /[,;|]+/).forEach(function (f) { cat.correlations.push({ brand: String(brand), model: String(model), engine: engine ? String(engine) : "", failure: f, probability: Number(pick(o, ["probabilite", "probability", "score"]) || 6), severity: String(pick(o, ["gravite", "severity"]) || "Élevé"), system: String(pick(o, ["systeme", "system"]) || "generic"), description: String(pick(o, ["description", "desc"]) || "") }); });
    });
    (eng || []).forEach(function (o) {
      var code = pick(o, ["code", "motorisation", "moteur", "engine", "nom", "name"]); if (!code) return;
      var ek = key(code);
      if (!eset[ek]) { eset[ek] = { code: String(code), names: toList(pick(o, ["names", "alias", "aliases", "libelle"]), /[,;|]+/), type: String(pick(o, ["type", "energie", "carburant"]) || ""), knownIssues: toList(pick(o, ["knownIssues", "pannes", "defauts"]), /[,;|]+/), brands: toList(pick(o, ["brands", "marques", "marque"]), /[,;|]+/) }; cat.engines.push(eset[ek]); }
    });
    return cat;
  }
  function normFailure(raw, src) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.start_url || raw.icons || raw.short_name || raw.display) return null;
    if (!pick(raw, ["cause", "origin", "origine", "mechanism", "mecanisme", "failure", "panne", "symptom", "symptome", "dtc"])) return null;
    var title = pick(raw, ["title", "titre", "name", "nom", "panne", "failure"]), desc = pick(raw, ["description", "desc", "detail", "resume"]) || "";
    if (!title && desc) title = String(desc).split(/[.\n]/)[0].slice(0, 90);
    if (!title || String(title).length < 5) return null;
    title = String(title).trim();
    if (!/[\s\-—·:]/.test(title) && title.length < 24) return null;
    var sys = norm(pick(raw, ["system", "systeme", "categorie", "domain"]) || "generic").replace(/\s+/g, "-") || "generic";
    var sev = String(pick(raw, ["severity", "gravite", "criticite"]) || "Élevé");
    var origin = pick(raw, ["origin", "origine", "cause", "source"]) || desc || title;
    var mech = pick(raw, ["mechanism", "mecanisme", "processus", "chaine"]) || desc || origin;
    var id = pick(raw, ["id", "uid", "ref", "reference"]) || ("imp-" + src.id + "-" + hash(norm(title) + "|" + sys));
    id = String(id).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80); if (!/^[a-zA-Z]/.test(id)) id = "imp-" + id;
    return { id: id, title: title.slice(0, 180), system: sys, energy: String(pick(raw, ["energy", "energie", "carburant"]) || "Thermique"), zone: String(pick(raw, ["zone", "localisation"]) || "Véhicule").slice(0, 90), severity: sev, priority: /crit/i.test(sev) ? 86 : /elev/i.test(sev) ? 76 : 64, keywords: uniq(toList(pick(raw, ["keywords", "motsCles", "tags", "aliases"]), /[,;|]+/).concat(title.split(/\s+/).filter(function (w) { return w.length > 3; }).slice(0, 8))).slice(0, 40), engines: toList(pick(raw, ["engines", "motorisations", "modeles", "vehicles", "marque"])).slice(0, 24), origin: String(origin).slice(0, 900), mechanism: String(mech).slice(0, 900), roots: toList(pick(raw, ["roots", "rootCauses", "causes", "racines"])).slice(0, 12), consequences: toList(pick(raw, ["consequences", "effects", "risques", "impacts"])).slice(0, 14), symptoms: toList(pick(raw, ["symptoms", "symptomes", "signes"])).slice(0, 14), dtc: toList(pick(raw, ["dtc", "codes", "obd"]), /[,;\s|]+/).filter(function (c) { return /^[PCBU][0-9]{4}$/i.test(c); }).slice(0, 16), evidence: toList(pick(raw, ["evidence", "preuves", "indices"])).slice(0, 14), tests: toList(pick(raw, ["tests", "controles", "verification"])).slice(0, 14), actions: toList(pick(raw, ["actions", "solutions", "correctives", "reparation"])).slice(0, 14), safety: toList(pick(raw, ["safety", "securite", "precautions"])).slice(0, 10), legal: String(pick(raw, ["legal", "juridique", "droit"]) || "").slice(0, 700), sources: src.url ? [{ label: src.name, url: src.url }] : [], related: [], updated: pick(raw, ["updated", "date", "maj"]) || new Date().toISOString(), sourceId: src.id, sourceName: src.name, sourceUrl: src.url || "", importedAt: Date.now(), imported: true };
  }
  function mergeFailures(l) { var m = {}, o = []; (l || []).forEach(function (r) { if (!r || !r.title) return; var k = norm(r.title).replace(/\s+/g, " ").slice(0, 120) + "|" + norm(r.system); if (!m[k]) { m[k] = JSON.parse(JSON.stringify(r)); o.push(k); return; } var c = m[k];["origin", "mechanism", "legal", "zone", "energy", "severity"].forEach(function (f) { if ((!c[f] || c[f].length < 3) && r[f]) c[f] = r[f]; });["keywords", "engines", "roots", "consequences", "symptoms", "dtc", "evidence", "tests", "actions", "safety"].forEach(function (f) { c[f] = uniq((c[f] || []).concat(r[f] || [])).slice(0, 40); }); c.priority = Math.max(c.priority || 0, r.priority || 0); }); return o.map(function (k) { return m[k]; }); }

  async function readIframeStorage(win) {
    var veh = [], eng = [], fail = [];
    try {
      ["localStorage", "sessionStorage"].forEach(function (sn) {
        try {
          var st = win[sn]; if (!st) return;
          for (var i = 0; i < st.length; i++) {
            var k = st.key(i), v = st.getItem(k); if (!v || v.length < 20) continue;
            var j = parse(v); if (j) walk(j, 0, veh, eng, fail);
            else if (v.length > 200 && /marque|modele|motorisation|puissance|ch\b/i.test(v)) { var c = candidates(v); veh = veh.concat(c.veh); eng = eng.concat(c.eng); fail = fail.concat(c.fail); }
          }
        } catch (e) {}
      });
    } catch (e) {}
    try {
      var keys = Object.keys(win);
      for (var i = 0; i < keys.length && i < 800; i++) {
        try {
          var v = win[keys[i]];
          if (v && typeof v === "object" && !Array.isArray(v) && /veh|marque|model|catalog|data|db|store|state|panne/i.test(keys[i])) walk(v, 0, veh, eng, fail);
          else if (Array.isArray(v) && v.length && typeof v[0] === "object") walk(v, 0, veh, eng, fail);
        } catch (e) {}
      }
    } catch (e) {}
    return { veh: veh, eng: eng, fail: fail };
  }
  async function probeIframe(url, onProg) {
    if (!sameOrigin(url)) { if (onProg) onProg("iframe ignorée (origine différente)", "warn"); return { veh: [], eng: [], fail: [] }; }
    return new Promise(function (resolve) {
      var f = D.createElement("iframe");
      f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
      f.style.cssText = "position:fixed;left:-99999px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none";
      f.src = url;
      var done = false;
      function finish(res) { if (done) return; done = true; clearTimeout(to); try { f.remove(); } catch (e) {} resolve(res); }
      var to = setTimeout(function () { finish({ veh: [], eng: [], fail: [] }); }, 22000);
      f.onerror = function () { finish({ veh: [], eng: [], fail: [] }); };
      f.onload = async function () {
        try {
          await new Promise(function (r) { setTimeout(r, 4200); });
          var win = f.contentWindow, doc = f.contentDocument;
          var veh = [], eng = [], fail = [];
          if (doc) {
            var t = tables(doc.documentElement.outerHTML); veh = veh.concat(t.veh); fail = fail.concat(t.fail);
            try { [].forEach.call(doc.scripts, function (s) { if (s.textContent && s.textContent.length > 40) { var c = candidates(s.textContent); veh = veh.concat(c.veh); eng = eng.concat(c.eng); fail = fail.concat(c.fail); } }); } catch (e) {}
            try { var rp = regexPairs(doc.body ? doc.body.innerText : ""); veh = veh.concat(rp); } catch (e) {}
          }
          if (win) { var st = await readIframeStorage(win); veh = veh.concat(st.veh); eng = eng.concat(st.eng); fail = fail.concat(st.fail); }
          if (onProg) onProg("Rendu SPA + stockage : " + veh.length + " véhicules · " + eng.length + " motorisations · " + fail.length + " pannes");
          finish({ veh: veh, eng: eng, fail: fail });
        } catch (e) { finish({ veh: [], eng: [], fail: [] }); }
      };
      D.body.appendChild(f);
    });
  }
  async function collect(src, opts) {
    var veh = [], eng = [], fail = [], root = stripHash(src.url), tried = {};
    async function tryUrl(u, label) {
      if (!u || tried[u]) return; tried[u] = 1;
      try {
        var t = await fetchText(u, opts.timeout);
        var c = candidates(t); veh = veh.concat(c.veh); eng = eng.concat(c.eng); fail = fail.concat(c.fail);
        if (/<html|<table/i.test(t)) { var tb = tables(t); veh = veh.concat(tb.veh); fail = fail.concat(tb.fail); veh = veh.concat(regexPairs(t)); }
        if (opts.onProgress) opts.onProgress((label || u) + " → " + veh.length + " véh · " + eng.length + " mot · " + fail.length + " pannes");
      } catch (e) { if (opts.onProgress) opts.onProgress((label || u) + " : " + e.message, "warn"); }
    }
    await tryUrl(root, "Racine");
    await tryUrl(abs("index.html", root), "index.html");
    var probes = src.probes || DEFAULT[0].probes;
    for (var i = 0; i < probes.length; i++) await tryUrl(abs(probes[i], root), probes[i]);
    try {
      var html = await fetchText(root, opts.timeout);
      var doc = new DOMParser().parseFromString(html, "text/html");
      var scripts = uniq([].map.call(doc.querySelectorAll("script[src]"), function (s) { return abs(s.getAttribute("src"), root); }).filter(Boolean));
      var preloads = uniq([].map.call(doc.querySelectorAll('link[rel="modulepreload"],link[rel="preload"][as="script"]'), function (l) { return abs(l.getAttribute("href"), root); }).filter(Boolean));
      var allS = uniq(scripts.concat(preloads)).slice(0, 14);
      for (var j = 0; j < allS.length; j++) {
        try { var js = await fetchText(allS[j], 12000); var c = candidates(js); veh = veh.concat(c.veh); eng = eng.concat(c.eng); fail = fail.concat(c.fail); veh = veh.concat(regexPairs(js)); if (opts.onProgress) opts.onProgress("Bundle " + (j + 1) + "/" + allS.length + " → " + veh.length + " véh"); } catch (e) {}
      }
      var jsonLinks = uniq([].map.call(doc.querySelectorAll('a[href$=".json"],link[href$=".json"]'), function (a) { return abs(a.getAttribute("href"), root); }).filter(Boolean)).slice(0, 10);
      for (var k = 0; k < jsonLinks.length; k++) await tryUrl(jsonLinks[k], "JSON lié");
      try {
        var am = await fetchText(abs("asset-manifest.json", root), 8000);
        var amj = parse(am);
        if (amj && amj.files) { var files = Object.keys(amj.files).map(function (k2) { return abs(amj.files[k2], root); }).filter(function (u) { return /\.js$|\.json$/.test(u); }).slice(0, 12); for (var q = 0; q < files.length; q++) { try { var jt = await fetchText(files[q], 10000); var cc = candidates(jt); veh = veh.concat(cc.veh); eng = eng.concat(cc.eng); fail = fail.concat(cc.fail); } catch (e) {} } }
      } catch (e) {}
    } catch (e) {}
    if (opts.deep !== false) {
      if (opts.onProgress) opts.onProgress("Rendu SPA (iframe same-origin) + lecture stockage…");
      var r = await probeIframe(src.url, opts.onProgress);
      veh = veh.concat(r.veh); eng = eng.concat(r.eng); fail = fail.concat(r.fail);
    }
    return { veh: veh, eng: eng, fail: fail };
  }
  async function update(opts) {
    if (busy) return { ok: false, total: 0, cat: 0 };
    opts = opts || {}; busy = true;
    var ids = opts.sourceIds && opts.sourceIds.length ? opts.sourceIds : sources.filter(function (s) { return s.enabled !== false; }).map(function (s) { return s.id; });
    var total = 0, catTotal = 0, results = [];
    try {
      for (var i = 0; i < ids.length; i++) {
        var src = sources.find(function (s) { return s.id === ids[i]; }); if (!src) continue;
        prog(src.id, "Lecture massive " + src.name, "info");
        meta[src.id] = Object.assign({}, meta[src.id], { status: "running" }); emit();
        var raw = { veh: [], eng: [], fail: [] };
        try { raw = await collect(src, { timeout: opts.timeout, deep: opts.deep !== false, onProgress: function (m, l) { prog(src.id, m, l); } }); } catch (e) { prog(src.id, "Erreur : " + e.message, "fail"); }
        var cat = toCatalog(raw.veh, raw.eng);
        var recs = mergeFailures(raw.fail.map(function (r) { return normFailure(r, src); }).filter(Boolean));
        if (opts.renew === false) recs = mergeFailures((imported[src.id] || []).concat(recs));
        imported[src.id] = recs;
        var added = CAT ? CAT.mergeCatalog(cat) : null;
        var cn = (cat.models || []).length + (cat.engines || []).length + (cat.brands || []).length;
        catTotal += cn; total += recs.length;
        var st = (recs.length || cn) ? "ok" : "warn";
        meta[src.id] = { last: Date.now(), count: recs.length, cat: cn, status: st, message: recs.length + " pannes · " + (cat.brands || []).length + " marques · " + (cat.models || []).length + " modèles · " + (cat.engines || []).length + " motorisations" };
        results.push({ id: src.id, count: recs.length, cat: cn, status: st });
        prog(src.id, src.name + " : " + meta[src.id].message, st === "ok" ? "ok" : st);
        await persist(); emit();
      }
      var ok = results.filter(function (r) { return r.status === "ok"; }).length;
      if (EIK) { EIK.setCheck("importMass", "Import massif sources", ok ? "ok" : "warn", ok + "/" + results.length + " sources · " + all().length + " pannes · " + catTotal + " entrées catalogue"); EIK.log("Import massif", ok > 0, total + " pannes · " + catTotal + " catalogue"); }
      return { ok: ok > 0, total: total, cat: catTotal, results: results };
    } finally { busy = false; emit(); }
  }
  async function importFile(f) {
    var t = await f.text(), veh = [], eng = [], fail = [];
    var j = parse(t);
    if (j) walk(j, 0, veh, eng, fail);
    else if (/<html|<table/i.test(t)) { var tb = tables(t); veh = tb.veh; fail = tb.fail; }
    if (!veh.length && !fail.length) { var c = candidates(t); veh = c.veh; eng = c.eng; fail = c.fail; }
    veh = veh.concat(regexPairs(t));
    var src = { id: "file-" + hash(f.name), name: "Import : " + f.name, url: "" };
    var cat = toCatalog(veh, eng), recs = mergeFailures(fail.map(function (r) { return normFailure(r, src); }).filter(Boolean));
    imported[src.id] = recs;
    if (!sources.some(function (s) { return s.id === src.id; })) sources.push({ id: src.id, name: src.name, url: "", enabled: true, deep: false, probes: [] });
    var cn = (cat.models || []).length + (cat.engines || []).length;
    meta[src.id] = { last: Date.now(), count: recs.length, cat: cn, status: "ok", message: recs.length + " pannes · " + cn + " entrées catalogue" };
    if (CAT) CAT.mergeCatalog(cat);
    await persist(); emit();
    return { ok: recs.length > 0 || cn > 0, count: recs.length, cat: cn };
  }
  async function clearImports() { imported = {}; Object.keys(meta).forEach(function (k) { if (k.indexOf("file-") === 0) delete meta[k]; else meta[k] = { last: meta[k] && meta[k].last, count: 0, cat: 0, status: "idle", message: "Imports vidés" }; }); sources = sources.filter(function (s) { return s.id.indexOf("file-") !== 0; }); await persist(); emit(); }
  async function addSource(u, n) { u = String(u || "").trim(); if (!/^https?:\/\//i.test(u)) return false; var id = "src-" + hash(u); if (sources.some(function (s) { return s.id === id; })) return false; sources.push({ id: id, name: n || new URL(u).hostname, url: u, enabled: true, deep: true, probes: DEFAULT[0].probes }); await persist(); emit(); return true; }
  async function removeSource(id) { sources = sources.filter(function (s) { return s.id !== id; }); delete imported[id]; delete meta[id]; await persist(); emit(); }
  async function toggleSource(id, en) { var s = sources.find(function (x) { return x.id === id; }); if (s) { s.enabled = !!en; await persist(); emit(); } }
  async function init() {
    try { var ls = localStorage.getItem("eik-import-sources"); if (ls) sources = JSON.parse(ls); var lm = localStorage.getItem("eik-import-meta"); if (lm) meta = JSON.parse(lm); } catch (e) {}
    if (!sources.length) { try { var r = await fetch("data/sources.json?v=" + VERSION, { cache: "no-cache" }); if (r.ok) { var j = await r.json(); if (Array.isArray(j) && j.length) sources = j; } } catch (e) {} }
    if (!sources.length) sources = JSON.parse(JSON.stringify(DEFAULT));
    try { var im = await get("imported"); if (im) imported = im; var me = await get("meta"); if (me) meta = me; var so = await get("sources"); if (Array.isArray(so) && so.length) sources = so; } catch (e) {}
    if (EIK) { EIK.importVersion = VERSION; EIK.setCheck("importEngine", "Moteur import massif", "ok", VERSION + " · " + all().length + " pannes importées"); }
    emit();
    var auto = localStorage.getItem("eik-auto-import") !== "0", last = 0;
    Object.keys(meta).forEach(function (k) { if (meta[k] && meta[k].last > last) last = meta[k].last; });
    if (auto && navigator.onLine && (Date.now() - last > 6 * 3600 * 1000)) setTimeout(function () { update({ renew: true }).catch(function () {}); }, 3000);
    return true;
  }
  var ready = init();
  return { version: VERSION, ready: ready, update: update, all: all, stats: stats, merge: mergeFailures, importFile: importFile, clearImports: clearImports, addSource: addSource, removeSource: removeSource, toggleSource: toggleSource, getSources: function () { return sources.slice(); }, getMeta: function () { return JSON.parse(JSON.stringify(meta)); }, isBusy: function () { return busy; }, expandLines: function (l) { return CAT ? CAT.expandLines(l) : null; } };
})();
