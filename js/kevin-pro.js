/* ================================================================
   KEVIN PRO v1 — Recherche prédictive enrichie + Galerie fiches
   moderne (filtres déroulants) + Mode présentation interactif
   Fichiers croisés : data/keywords.json <-> window.FICHES <-> css/kevin-pro.css
   ================================================================ */
(function () {
  "use strict";
  var D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var KW = null;
  var FALLBACK = { expand: { courroie: ["distribution", "courroie humide", "wet belt", "1.2 PureTech", "EcoBlue", "EB2", "P0016"], fap: ["DPF", "filtre à particules", "régénération", "P2463", "catalyseur"], runaway: ["emballement thermique", "NMC", "LFP", "BMS", "ré-ignition"] } };
  var SYSTEMS = [
    { id: "distribution", label: "⛓️ Distribution / courroie", kw: ["courroie", "distribution", "puretech", "ecoblue", "calage", "tendeur"] },
    { id: "injection", label: "⛽ Injection / carburant", kw: ["injecteur", "rampe", "carburant", "gdi", "common rail", "aerosol"] },
    { id: "gpl", label: "⛽ GPL", kw: ["gpl", "multivalve"] },
    { id: "echappement", label: "🌫️ Échappement / FAP / cata", kw: ["fap", "dpf", "catalyseur", "cata", "collecteur", "echappement", "regen", "vegetation"] },
    { id: "turbo", label: "🌀 Turbo", kw: ["turbo"] },
    { id: "refroidissement", label: "🌡️ Refroidissement / surchauffe", kw: ["surchauffe", "ldr", "glycol", "pompe a eau", "thermostat", "grippage", "refroidissement"] },
    { id: "basse12", label: "🔋 12V / DC-DC / USB", kw: ["12v", "cosse", "dc-dc", "usb", "chargeur", "h2"] },
    { id: "ht", label: "🔌 Pack HT / cellules", kw: ["pack", "cellule", "runaway", "nmc", "lfp", "bms", "busbar", "immersion", "re-ignition", "choc"] },
    { id: "charge", label: "🔌 Charge DC / OBC", kw: ["charge", "obc", "contacteur", "broches", "wallbox", "onduleur", "trappe"] },
    { id: "freins", label: "🛑 Freins", kw: ["frein", "etrier", "disque"] },
    { id: "faisceau", label: "⚡ Faisceau / courts-circuits", kw: ["faisceau", "court", "arc", "gaine", "rongeur", "pcb"] },
    { id: "habitacle", label: "🚬 Habitacle / usager", kw: ["megot", "habitacle", "siege", "mousse", "vide-poche"] }
  ];
  var DTC = [
    { code: "P0016", txt: "Corrélation vilebrequin / arbre à cames — calage, courroie ou chaîne décalée (PureTech, EcoBlue…)", q: "courroie distribution" },
    { code: "P0087", txt: "Pression rampe carburant trop basse — fuite HP, pompe, injecteur", q: "fuite carburant injection" },
    { code: "P0217", txt: "Surchauffe moteur — pompe à eau, thermostat, perte LDR", q: "surchauffe grippage" },
    { code: "P0300", txt: "Ratés d'allumage multiples — mélange pauvre, catalyseur en surchauffe", q: "collecteur echappement" },
    { code: "P0562", txt: "Tension système 12V basse — batterie, cosse, DC-DC", q: "12v dc-dc" },
    { code: "P2463", txt: "FAP : accumulation de suie — régénérations incomplètes", q: "fap regeneration" },
    { code: "P244A", txt: "FAP : pression différentielle trop basse — filtre fissuré ou absent", q: "fap" },
    { code: "P0420", txt: "Rendement catalyseur sous seuil — cata dégradé / surchauffe", q: "catalyseur echappement" },
    { code: "P0AA6", txt: "Défaut d'isolement HT — pack, OBC, câblage haute tension", q: "pack ht isolation obc" }
  ];
  var LEGAL = [
    { code: "Art. 1641 C. civ.", txt: "Vice caché antérieur à la vente — action rédhibitoire ou estimatoire", q: "vice cache" },
    { code: "Art. L421-3 C. conso.", txt: "Produits défectueux (10 ans) — défaut de fabrication, rappel constructeur", q: "rappel defaut" },
    { code: "Art. L421-2 C. conso.", txt: "Obligation de sécurité et de conseil du constructeur — usage, notices", q: "securite conseil" },
    { code: "Expertise CPC", txt: "Expertise contradictoire — mission, sapiteur, conservation des traces", q: "expertise" }
  ];
  var GROUPS = { fiche: "🔥 Fiches origine de feu", rappel: "🚨 Rappels constructeurs", dtc: "🔧 Codes DTC", legal: "⚖️ Juridique" };

  function themes() { return (KW && KW.themes) || SYSTEMS; }
  function energy(f) {
    var id = String(f.id || "");
    if (/^ev/i.test(id)) return "VE";
    if (/^th/i.test(id)) return "Thermique";
    var t = norm(f.title + " " + (f.zone || ""));
    return /pack|runaway|lfp|nmc|obc|charge dc|bms/.test(t) ? "VE" : "Thermique";
  }
  function systemsOf(f) {
    var t = norm([f.title, f.zone, f.cause, f.mech, f.idx].join(" "));
    var out = [];
    themes().forEach(function (s) { if (s.kw.some(function (k) { return t.indexOf(norm(k)) >= 0; })) out.push(s.id); });
    return out.length ? out : ["autre"];
  }
  function legalTags(f) {
    var t = norm(f.legal), out = [];
    if (t.indexOf("vice cache") >= 0) out.push("vice-cache");
    if (t.indexOf("rappel") >= 0 || t.indexOf("l421") >= 0) out.push("rappel");
    if (t.indexOf("entretien") >= 0 || t.indexOf("usage") >= 0) out.push("entretien");
    if (t.indexOf("externe") >= 0 || t.indexOf("force majeure") >= 0 || t.indexOf("usager") >= 0) out.push("externe");
    return out;
  }
  function expandQuery(q) {
    var src = (KW && KW.expand) || FALLBACK.expand;
    var tokens = norm(q).split(/[^a-z0-9]+/).filter(function (t) { return t.length > 1; });
    var terms = tokens.slice(), chips = [];
    tokens.forEach(function (tk) {
      Object.keys(src).forEach(function (key) {
        var k = norm(key);
        if (tk === k || (tk.length > 3 && k.indexOf(tk) === 0) || (k.length > 3 && tk.indexOf(k) === 0)) {
          src[key].forEach(function (e) {
            var n = norm(e);
            if (terms.indexOf(n) < 0) { terms.push(n); if (chips.indexOf(e) < 0) chips.push(e); }
          });
        }
      });
    });
    return { terms: terms, chips: chips.slice(0, 12) };
  }
  function buildDocs() {
    var docs = [];
    (window.FICHES || []).forEach(function (f) {
      docs.push({ g: "fiche", id: f.id, title: f.title, body: [f.zone, f.cause, f.mech, f.idx, f.dtc, f.legal].join(" "), keys: systemsOf(f).join(" "), ref: f });
    });
    var R = window.RECALLS || window.RECALLS_DATA || [];
    if (R && R.length) R.slice(0, 400).forEach(function (r, i) {
      var t = [r.brand || r.marque, r.model || r.modele, r.subject || r.titre || r.title, r.energy || r.energie].filter(Boolean).join(" ");
      if (t) docs.push({ g: "rappel", id: "r" + i, title: t, body: String(r.description || r.detail || ""), keys: "", ref: r });
    });
    DTC.forEach(function (d) { docs.push({ g: "dtc", id: d.code, title: d.code + " — " + d.txt, body: d.q, keys: "", ref: d }); });
    LEGAL.forEach(function (l) { docs.push({ g: "legal", id: l.code, title: l.code + " — " + l.txt, body: l.q, keys: "", ref: l }); });
    return docs;
  }
  function search(q) {
    var ex = expandQuery(q), out = [];
    buildDocs().forEach(function (d) {
      var sc = 0, hits = 0, ti = norm(d.title), bo = norm(d.body), ke = norm(d.keys);
      ex.terms.forEach(function (t) {
        if (ti.indexOf(t) >= 0) { sc += 12; hits++; }
        else if (ke.indexOf(t) >= 0) { sc += 8; hits++; }
        else if (bo.indexOf(t) >= 0) { sc += 4; hits++; }
      });
      if (hits) out.push({ d: d, sc: sc });
    });
    out.sort(function (a, b) { return b.sc - a.sc; });
    return { ex: ex, hits: out.slice(0, 30) };
  }
  function bestFicheFor(q) {
    var h = search(q).hits.find(function (x) { return x.d.g === "fiche"; });
    return h ? h.d.ref : null;
  }

  /* ---------- Recherche prédictive ---------- */
  var panel = null, active = -1, currentHits = [];
  function ensurePanel() {
    if (panel) return panel;
    panel = D.createElement("div"); panel.id = "kpPredict"; panel.className = "kp-predict"; panel.hidden = true;
    var input = $("#unifiedInput");
    if (input) {
      var p = input.parentNode;
      if (getComputedStyle(p).position === "static") p.style.position = "relative";
      p.appendChild(panel);
    } else { D.body.appendChild(panel); panel.classList.add("kp-modal"); }
    panel.addEventListener("click", function (e) {
      var ch = e.target.closest(".kp-chip");
      if (ch) { var inp = $("#unifiedInput"); if (inp) { inp.value = ch.textContent.trim(); inp.focus(); renderPredict(inp.value); } return; }
      var it = e.target.closest("[data-g]");
      if (it) { openResult(it.dataset.g, it.dataset.id); closePanel(); }
    });
    return panel;
  }
  function renderPredict(q) {
    ensurePanel();
    if (!q || q.trim().length < 2) { closePanel(); return; }
    var r = search(q); currentHits = r.hits; active = r.hits.length ? 0 : -1;
    var html = "";
    if (r.ex.chips.length) html += '<div class="kp-chips"><span class="kp-chips-lbl">🧠 Aussi :</span>' + r.ex.chips.map(function (c) { return '<button type="button" class="kp-chip">' + esc(c) + "</button>"; }).join("") + "</div>";
    if (!r.hits.length) html += '<div class="kp-empty">Aucun résultat — essayez « courroie », « FAP », « runaway », « 12V »…</div>';
    var lastG = "";
    r.hits.forEach(function (h, i) {
      if (h.d.g !== lastG) { lastG = h.d.g; html += '<div class="kp-group">' + GROUPS[lastG] + "</div>"; }
      html += '<div class="kp-item' + (i === active ? " active" : "") + '" data-g="' + h.d.g + '" data-id="' + esc(h.d.id) + '"><span>' + esc(h.d.title) + "</span><small>" + (h.d.g === "fiche" ? esc(h.d.ref.zone || "") : "") + "</small></div>";
    });
    panel.innerHTML = html; panel.hidden = false;
    var old = $("#unifiedPredict"); if (old) old.style.display = "none";
  }
  function closePanel() { if (panel) panel.hidden = true; active = -1; }
  function updateActive() {
    var items = panel.querySelectorAll(".kp-item");
    items.forEach(function (el, i) { el.classList.toggle("active", i === active); });
    if (items[active]) items[active].scrollIntoView({ block: "nearest" });
  }
  function openResult(g, id) {
    if (g === "fiche") return openDeck(id);
    if (g === "dtc") { var d = DTC.find(function (x) { return x.code === id; }); if (d) { var f = bestFicheFor(d.q); if (f) return openDeck(f.id); } return; }
    if (g === "legal") { window.open("https://www.legifrance.gouv.fr/search/all?query=" + encodeURIComponent(id), "_blank", "noopener"); return; }
    if (g === "rappel") {
      var R = window.RECALLS || window.RECALLS_DATA || [];
      var r = R[parseInt(id.slice(1), 10)];
      var u = r && (r.url || r.link || r.source);
      if (u && /^https?:/i.test(u)) window.open(u, "_blank", "noopener");
      else { var s = $("#section-recalls"); if (s) s.scrollIntoView({ behavior: "smooth" }); }
    }
  }
  function attachSearch() {
    var input = $("#unifiedInput");
    if (!input) return;
    var t = null;
    input.addEventListener("input", function () { clearTimeout(t); t = setTimeout(function () { renderPredict(input.value); }, 120); });
    input.addEventListener("focus", function () { if (input.value.trim().length > 1) renderPredict(input.value); });
    input.addEventListener("keydown", function (e) {
      if (!panel || panel.hidden) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!currentHits.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + currentHits.length) % currentHits.length;
        updateActive();
      } else if (e.key === "Enter") {
        if (active >= 0 && currentHits[active]) { e.preventDefault(); e.stopImmediatePropagation(); var h = currentHits[active]; openResult(h.d.g, h.d.id); closePanel(); }
      } else if (e.key === "Escape") { closePanel(); }
    }, true);
    D.addEventListener("click", function (e) { if (panel && !panel.hidden && !panel.contains(e.target) && e.target !== input) closePanel(); });
  }

  /* ---------- Galerie moderne + filtres déroulants ---------- */
  var rendering = false, mo = null;
  function uniqueZones() { var z = []; (window.FICHES || []).forEach(function (f) { if (f.zone && z.indexOf(f.zone) < 0) z.push(f.zone); }); return z.sort(); }
  var LEGAL_FILTERS = [{ id: "vice-cache", label: "⚖️ Vice caché (1641)" }, { id: "rappel", label: "🚨 Rappel / L421" }, { id: "entretien", label: "🔧 Entretien / usage" }, { id: "externe", label: "🌍 Cause externe" }];
  function enhanceGallery() {
    var grid = $("#ftGrid"); if (!grid) return;
    var old = $("#kpFilters"); if (old) old.remove();
    if (mo) { mo.disconnect(); mo = null; }
    var bar = D.createElement("div"); bar.id = "kpFilters"; bar.className = "kp-filters";
    bar.innerHTML =
      '<select id="kpEnergy"><option value="">⚡ Énergie : toutes</option><option value="Thermique">🔥 Thermique</option><option value="VE">🔋 Électrique</option></select>' +
      '<select id="kpZone"><option value="">📍 Zone : toutes</option>' + uniqueZones().map(function (z) { return '<option>' + esc(z) + "</option>"; }).join("") + "</select>" +
      '<select id="kpSystem"><option value="">⚙️ Système : tous</option>' + themes().map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.label) + "</option>"; }).join("") + "</select>" +
      '<select id="kpLegal"><option value="">⚖️ Juridique : tous</option>' + LEGAL_FILTERS.map(function (l) { return '<option value="' + l.id + '">' + l.label + "</option>"; }).join("") + "</select>" +
      '<input id="kpText" placeholder="🔎 Filtrer (ex. courroie, FAP, 12V…)" list="kpSuggest"><datalist id="kpSuggest"></datalist>' +
      '<select id="kpSort"><option value="pert">Tri : pertinence</option><option value="az">Titre A→Z</option><option value="zone">Par zone</option></select>' +
      '<button id="kpReset" type="button">↺ Réinitialiser</button>' +
      '<button id="kpPresent" type="button" class="kp-primary">📽️ Tout présenter</button>' +
      '<span id="kpCount" class="kp-count"></span>';
    grid.parentNode.insertBefore(bar, grid);
    ["kpEnergy", "kpZone", "kpSystem", "kpLegal", "kpSort"].forEach(function (id) { $("#" + id).addEventListener("change", renderCards); });
    $("#kpText").addEventListener("input", function () { clearTimeout(bar._t); bar._t = setTimeout(renderCards, 150); });
    $("#kpReset").addEventListener("click", function () { ["kpEnergy", "kpZone", "kpSystem", "kpLegal"].forEach(function (id) { $("#" + id).value = ""; }); $("#kpText").value = ""; $("#kpSort").value = "pert"; renderCards(); });
    $("#kpPresent").addEventListener("click", function () { var l = filteredFiches(); if (l.length) openDeck(l[0].id, l); });
    if (!grid.dataset.kpBound) {
      grid.dataset.kpBound = "1";
      grid.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]"); if (!b) return;
        var card = b.closest(".kp-card"), id = card.dataset.id;
        if (b.dataset.act === "deck") openDeck(id, filteredFiches());
        else { var m = card.querySelector(".kp-more"); m.hidden = !m.hidden; b.textContent = m.hidden ? "📋 Détails" : "▲ Réduire"; }
      });
    }
    renderCards();
    mo = new MutationObserver(function () {
      if (rendering) return;
      clearTimeout(mo._t);
      mo._t = setTimeout(function () { var g = $("#ftGrid"); if (g && !g.querySelector(".kp-card")) renderCards(); }, 250);
    });
    mo.observe(grid, { childList: true });
  }
  function filteredFiches() {
    var list = (window.FICHES || []).slice();
    var en = $("#kpEnergy") ? $("#kpEnergy").value : "";
    var zo = $("#kpZone") ? $("#kpZone").value : "";
    var sy = $("#kpSystem") ? $("#kpSystem").value : "";
    var le = $("#kpLegal") ? $("#kpLegal").value : "";
    var tx = $("#kpText") ? $("#kpText").value.trim() : "";
    var sort = $("#kpSort") ? $("#kpSort").value : "pert";
    if (en) list = list.filter(function (f) { return energy(f) === en; });
    if (zo) list = list.filter(function (f) { return f.zone === zo; });
    if (sy) list = list.filter(function (f) { return systemsOf(f).indexOf(sy) >= 0; });
    if (le) list = list.filter(function (f) { return legalTags(f).indexOf(le) >= 0; });
    if (tx) {
      var terms = expandQuery(tx).terms;
      list = list.map(function (f) {
        var ti = norm(f.title), bo = norm([f.zone, f.cause, f.mech, f.idx, f.dtc, f.legal].join(" ")), sc = 0;
        terms.forEach(function (t) { if (ti.indexOf(t) >= 0) sc += 12; else if (bo.indexOf(t) >= 0) sc += 4; });
        return { f: f, sc: sc };
      }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; }).map(function (x) { return x.f; });
    }
    if (sort === "az") list.sort(function (a, b) { return a.title.localeCompare(b.title, "fr"); });
    else if (sort === "zone") list.sort(function (a, b) { return String(a.zone).localeCompare(String(b.zone), "fr"); });
    return list;
  }
  function renderCards() {
    var grid = $("#ftGrid"); if (!grid) return;
    rendering = true;
    var list = filteredFiches();
    grid.classList.add("kp-grid");
    grid.innerHTML = list.map(function (f, i) {
      var en = energy(f), sys = systemsOf(f);
      var tags = sys.map(function (s) { var t = themes().find(function (x) { return x.id === s; }); return t ? '<span class="kp-tag">' + esc(t.label) + "</span>" : ""; }).join("");
      return '<article class="kp-card" data-id="' + esc(f.id) + '" style="animation-delay:' + Math.min(i * 40, 400) + 'ms">' +
        '<div class="kp-card-top ' + (en === "VE" ? "kp-ev" : "kp-th") + '"><span>' + (en === "VE" ? "🔋 VE" : "🔥 Thermique") + "</span><span>📍 " + esc(f.zone || "") + "</span></div>" +
        "<h4>" + esc(f.title) + "</h4>" +
        '<p class="kp-cause">' + esc(f.cause || "") + "</p>" +
        '<div class="kp-tags">' + tags + (f.dtc && f.dtc !== "—" ? '<span class="kp-tag kp-dtc">🔧 ' + esc(f.dtc) + "</span>" : "") + "</div>" +
        '<div class="kp-actions"><button type="button" data-act="deck" class="kp-primary">📽️ Présenter</button><button type="button" data-act="more">📋 Détails</button></div>' +
        '<div class="kp-more" hidden>' +
        "<p><b>🔗 Mécanisme :</b> " + esc(f.mech || "") + "</p>" +
        "<p><b>🔍 Indices :</b> " + esc(f.idx || "") + "</p>" +
        "<p><b>⚖️ Juridique :</b> " + esc(f.legal || "") + "</p>" +
        (f.src && /^https?:/i.test(f.src) ? '<p><a href="' + esc(f.src) + '" target="_blank" rel="noopener">🔗 Source</a></p>' : "") +
        "</div></article>";
    }).join("");
    var c = $("#kpCount"); if (c) c.textContent = list.length + " fiche(s)";
    var sg = $("#kpSuggest"); if (sg) sg.innerHTML = (window.FICHES || []).map(function (f) { return '<option value="' + esc(f.title) + '">'; }).join("");
    setTimeout(function () { rendering = false; }, 300);
  }

  /* ---------- Mode présentation interactif (type PowerPoint) ---------- */
  var deckEl = null, deckList = [], deckIdx = 0, slideIdx = 0, touchX = null;
  function slidesOf(f) {
    return [
      { h: f.title, cover: true },
      { h: "1 · Cause", b: f.cause },
      { h: "2 · Mécanisme → conséquence", b: f.mech },
      { h: "3 · Indices sapiteur", b: f.idx },
      { h: "4 · Codes DTC", b: f.dtc && f.dtc !== "—" ? f.dtc : "Aucun DTC spécifique — raisonnement par traces, logs et cartographie." },
      { h: "5 · Qualification juridique", b: f.legal },
      { h: "6 · Source & suites", src: f.src || "" }
    ];
  }
  function openDeck(id, list) {
    deckList = (list && list.length ? list : (window.FICHES || [])).slice();
    if (!deckList.length) return;
    deckIdx = Math.max(0, deckList.findIndex(function (f) { return f.id === id; }));
    slideIdx = 0;
    if (!deckEl) buildDeck();
    deckEl.hidden = false; D.body.style.overflow = "hidden";
    renderSlide();
  }
  function buildDeck() {
    deckEl = D.createElement("div"); deckEl.id = "kpDeck"; deckEl.hidden = true;
    deckEl.innerHTML =
      '<div class="kp-deck-bar"><div id="kpProgress"></div></div>' +
      '<div class="kp-deck-head"><span id="kpDeckTitle"></span><div class="kp-deck-btns">' +
      '<button id="kpOverview" type="button" title="Vue d\'ensemble">🗂️</button>' +
      '<button id="kpFull" type="button" title="Plein écran (F)">⛶</button>' +
      '<button id="kpClose" type="button" title="Quitter (Échap)">✕</button></div></div>' +
      '<div class="kp-slide" id="kpSlide"></div>' +
      '<div class="kp-deck-nav"><button id="kpPrev" type="button">← Précédent</button><span id="kpDots"></span><button id="kpNext" type="button">Suivant →</button></div>' +
      '<div class="kp-deck-foot"><button id="kpPrevF" type="button">⏮ Fiche précédente</button><span id="kpSlideNum"></span><button id="kpNextF" type="button">Fiche suivante ⏭</button></div>' +
      '<div id="kpGrid" class="kp-overview" hidden></div>';
    D.body.appendChild(deckEl);
    $("#kpClose").onclick = closeDeck;
    $("#kpPrev").onclick = function () { step(-1); };
    $("#kpNext").onclick = function () { step(1); };
    $("#kpPrevF").onclick = function () { deckIdx = (deckIdx - 1 + deckList.length) % deckList.length; slideIdx = 0; renderSlide(); };
    $("#kpNextF").onclick = function () { deckIdx = (deckIdx + 1) % deckList.length; slideIdx = 0; renderSlide(); };
    $("#kpFull").onclick = function () { if (D.fullscreenElement) D.exitFullscreen(); else if (deckEl.requestFullscreen) deckEl.requestFullscreen(); };
    $("#kpOverview").onclick = function () {
      var g = $("#kpGrid");
      if (!g.hidden) { g.hidden = true; return; }
      g.innerHTML = deckList.map(function (f, i) { return '<button type="button" class="kp-ov' + (i === deckIdx ? " active" : "") + '" data-i="' + i + '"><b>' + esc(f.title) + "</b><small>" + esc(f.zone || "") + "</small></button>"; }).join("");
      g.hidden = false;
    };
    $("#kpGrid").addEventListener("click", function (e) { var b = e.target.closest(".kp-ov"); if (!b) return; deckIdx = parseInt(b.dataset.i, 10); slideIdx = 0; $("#kpGrid").hidden = true; renderSlide(); });
    D.addEventListener("keydown", function (e) {
      if (!deckEl || deckEl.hidden) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); step(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); step(-1); }
      else if (e.key === "Escape") closeDeck();
      else if (e.key.toLowerCase() === "f") $("#kpFull").click();
    });
    deckEl.addEventListener("touchstart", function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    deckEl.addEventListener("touchend", function (e) {
      if (touchX == null) return;
      var dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  }
  function step(d) {
    var n = slidesOf(deckList[deckIdx]).length;
    slideIdx += d;
    if (slideIdx >= n) { if (deckIdx < deckList.length - 1) { deckIdx++; slideIdx = 0; } else slideIdx = n - 1; }
    if (slideIdx < 0) { if (deckIdx > 0) { deckIdx--; slideIdx = slidesOf(deckList[deckIdx]).length - 1; } else slideIdx = 0; }
    renderSlide();
  }
  function renderSlide() {
    var f = deckList[deckIdx]; if (!f) return closeDeck();
    var sl = slidesOf(f), s = sl[slideIdx];
    $("#kpDeckTitle").textContent = "🔥 " + f.title;
    var box = $("#kpSlide");
    box.classList.remove("kp-anim"); void box.offsetWidth; box.classList.add("kp-anim");
    var en = energy(f);
    if (s.cover) {
      box.innerHTML = '<div class="kp-cover"><span class="kp-energy-big ' + (en === "VE" ? "kp-ev" : "kp-th") + '">' + (en === "VE" ? "🔋 VÉHICULE ÉLECTRIQUE" : "🔥 THERMIQUE") + "</span><h2>" + esc(f.title) + "</h2><p>📍 " + esc(f.zone || "") + '</p><p class="kp-hint">← → pour naviguer · Échap pour quitter</p></div>';
    } else if (s.src !== undefined) {
      box.innerHTML = "<h3>" + esc(s.h) + "</h3>" + (s.src && /^https?:/i.test(s.src) ? '<p><a class="kp-src" href="' + esc(s.src) + '" target="_blank" rel="noopener">🔗 Ouvrir la source</a></p>' : "<p>Source : documentation interne.</p>") + '<p class="kp-hint">⏭ pour la fiche suivante</p>';
    } else {
      box.innerHTML = "<h3>" + esc(s.h) + '</h3><p class="kp-body">' + esc(s.b || "—") + "</p>";
    }
    $("#kpProgress").style.width = Math.round(((slideIdx + 1) / sl.length) * 100) + "%";
    $("#kpDots").innerHTML = sl.map(function (x, i) { return '<span class="kp-dot' + (i === slideIdx ? " on" : "") + '"></span>'; }).join("");
    $("#kpSlideNum").textContent = "Fiche " + (deckIdx + 1) + "/" + deckList.length + " · Diapo " + (slideIdx + 1) + "/" + sl.length;
    try { history.replaceState(null, "", "#kp-deck=" + encodeURIComponent(f.id)); } catch (e) {}
  }
  function closeDeck() {
    if (deckEl) deckEl.hidden = true;
    D.body.style.overflow = "";
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
  }

  /* ---------- Démarrage ---------- */
  function tryGallery(n) {
    if ($("#ftGrid")) enhanceGallery();
    else if (n < 8) setTimeout(function () { tryGallery(n + 1); }, 700);
  }
  function boot() {
    var l = D.createElement("link"); l.rel = "stylesheet"; l.href = "css/kevin-pro.css"; D.head.appendChild(l);
    attachSearch();
    tryGallery(0);
    fetch("data/keywords.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.expand) { KW = j; if ($("#kpFilters")) enhanceGallery(); }
    }).catch(function () {});
    var m = /kp-deck=([^&]+)/.exec(location.hash || "");
    if (m) setTimeout(function () { openDeck(decodeURIComponent(m[1])); }, 800);
  }
  if (D.readyState === "complete") setTimeout(boot, 300);
  else window.addEventListener("load", function () { setTimeout(boot, 300); });
})();
