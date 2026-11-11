/* APP — fichier croisé n°3 : écrans, admin, fond, recherche, Bluetooth, réseau */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => /^https?:\/\//i.test(u || "") ? u : "#";
const LABEL = { pending: "⏳ En attente", granted: "✅ Accès accordé", denied: "⛔ Refusé", revoked: "🔄 Révoqué" };
function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
const state = load("eik-state", { devices: {}, refs: {}, wp: null, stateTs: 0 });
function save() { try { localStorage.setItem("eik-state", JSON.stringify(state)); } catch (e) { toast("⚠️ Stockage plein"); } }
const myId = localStorage.getItem("eik-id") || (function () { const id = crypto.randomUUID(); localStorage.setItem("eik-id", id); return id; })();
let isAdmin = sessionStorage.getItem("eik-admin") === "1";
let seedRefs = [], frameMounted = false, lockTimer = null, lastRebroadcast = 0;

function toast(msg, ms) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms || 4500); }
function show(id) { document.querySelectorAll(".screen").forEach(s => s.hidden = true); $("#" + id).hidden = false; }
function route() {
  if (isAdmin) { renderAdmin(); return show("scrAdmin"); }
  const me = state.devices[myId];
  if (me) {
    if (me.status === "granted") { mountFrame(); return show("scrApp"); }
    if (me.status === "pending") return show("scrWait");
    if (me.status === "denied") return show("scrDenied");
    if (me.status === "revoked") return show("scrRevoked");
  }
  if (localStorage.getItem("eik-asked") === "1") return show("scrWait");
  show("scrGate");
}
function mountFrame() {
  if (frameMounted) return;
  frameMounted = true;
  const f = $("#frame");
  f.addEventListener("load", applyWp);
  f.src = CONFIG.STUDY_PAGE;
}
function applyWp() {
  const bg = $("#bg");
  if (state.wp) { bg.style.backgroundImage = "url(" + state.wp.img + ")"; bg.style.opacity = state.wp.opacity; }
  else bg.style.backgroundImage = "none";
  try {
    const d = $("#frame").contentDocument;
    if (d && d.body && state.wp) {
      const veil = 1 - state.wp.opacity;
      d.body.style.background = "linear-gradient(rgba(11,18,32," + veil + "),rgba(11,18,32," + veil + ")),url(" + state.wp.img + ") center/cover fixed";
    }
  } catch (e) {}
}
async function fetchWp(m) {
  try {
    const blob = await (await fetch(m.url)).blob();
    const img = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
    state.wp = { img: img, ts: m.ts, opacity: m.opacity };
    save(); applyWp();
  } catch (e) {}
}
function compress(file, maxDim, quality) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      let dim = maxDim, q = quality, out = "";
      do {
        const sc = Math.min(1, dim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", q);
        dim = Math.round(dim * 0.75); q -= 0.12;
      } while (out.length > 1400000 && q > 0.3);
      URL.revokeObjectURL(img.src); res(out);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
function armLock() { clearTimeout(lockTimer); lockTimer = setTimeout(lockAdmin, CONFIG.ADMIN_LOCK_MIN * 60000); }
function lockAdmin() { isAdmin = false; sessionStorage.removeItem("eik-admin"); clearTimeout(lockTimer); route(); toast("🔒 Session admin verrouillée"); }
function publishState() { state.stateTs = Date.now(); save(); Sync.publish({ t: "state", devices: state.devices, ts: state.stateTs }); }
function renderAdmin() {
  if (!isAdmin) return;
  const ul = $("#reqList"); ul.innerHTML = "";
  const list = Object.entries(state.devices).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
  $("#reqCount").textContent = list.length;
  list.forEach(([id, d]) => {
    const li = document.createElement("li");
    li.innerHTML =
      '<div class="reqhead"><b>' + esc(d.name || "?") + '</b> <span class="badge ' + esc(d.status) + '">' + esc(LABEL[d.status] || d.status) + "</span>" +
      "<small>" + new Date(d.ts || 0).toLocaleString("fr-FR") + "</small></div>" +
      '<div class="row">' +
      '<button data-id="' + esc(id) + '" data-s="granted">✅ Accès</button>' +
      '<button data-id="' + esc(id) + '" data-s="denied">⛔ Refus</button>' +
      '<button data-id="' + esc(id) + '" data-s="revoked">🔄 Révoquer</button>' +
      '<button data-id="' + esc(id) + '" data-s="del" class="danger">🗑️</button></div>';
    ul.appendChild(li);
  });
}
async function rebroadcast() {
  if (!isAdmin || Date.now() - lastRebroadcast < 60000) return;
  lastRebroadcast = Date.now();
  publishState();
  Object.values(state.refs).forEach(r => Sync.publish(r));
  if (state.wp) {
    try {
      const blob = await (await fetch(state.wp.img)).blob();
      const url = await Sync.publishFile(blob, "fond.jpg");
      Sync.publish({ t: "wp", url: url, ts: state.wp.ts, opacity: state.wp.opacity });
    } catch (e) {}
  }
}
function onMsg(m) {
  switch (m.t) {
    case "hello": if (isAdmin) rebroadcast(); break;
    case "req":
      if (isAdmin) {
        const cur = state.devices[m.id];
        state.devices[m.id] = { name: String(m.name || "?").slice(0, 40), status: cur && cur.status === "granted" ? "granted" : "pending", ts: m.ts };
        save(); publishState(); renderAdmin();
        toast("📨 Demande d'accès : " + String(m.name || "?").slice(0, 40));
      }
      break;
    case "state":
      if ((m.ts || 0) >= state.stateTs) { state.devices = m.devices || {}; state.stateTs = m.ts || 0; save(); route(); }
      break;
    case "wp": if (!state.wp || (m.ts || 0) > state.wp.ts) fetchWp(m); break;
    case "wpdel": state.wp = null; save(); applyWp(); break;
    case "note": toast("📢 " + String(m.text || "").slice(0, 300), 9000); break;
    case "ref": if (m.rid) { state.refs[m.rid] = m; save(); renderRefs(); } break;
    case "refdel": if (m.rid) { delete state.refs[m.rid]; save(); renderRefs(); } break;
  }
}
function askAccess(name) {
  state.devices[myId] = { name: name, status: "pending", ts: Date.now() };
  save(); route();
  Sync.publish({ t: "req", id: myId, name: name });
  toast("📨 Demande envoyée à l'admin");
}
async function loadSeed() { try { seedRefs = await (await fetch("data/references.json")).json(); } catch (e) { seedRefs = []; } renderRefs(); }
function allRefs() { return Object.values(state.refs).concat(seedRefs); }
function renderRefs() {
  const q = $("#q").value.trim().toLowerCase(), cat = $("#qType").value;
  const list = allRefs().filter(r => (cat === "tous" || r.cat === cat) && (!q || ((r.title || "") + " " + (r.note || "")).toLowerCase().includes(q)));
  const ul = $("#refList"); ul.innerHTML = "";
  list.slice(0, 60).forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = '<span class="badge ' + esc(r.cat) + '">' + (r.cat === "juridique" ? "⚖️" : "🔧") + "</span> " +
      '<a href="' + esc(safeUrl(r.url)) + '" target="_blank" rel="noopener">' + esc(r.title) + "</a>" +
      (r.note ? "<small>" + esc(r.note) + "</small>" : "");
    ul.appendChild(li);
  });
  $("#refCount").textContent = list.length;
  const last = Object.values(state.refs).reduce((a, r) => Math.max(a, r.ts || 0), 0);
  $("#refUpdated").textContent = last ? "Dernière MAJ manuelle : " + new Date(last).toLocaleString("fr-FR") : "Base initiale embarquée";
  $("#suggest").innerHTML = allRefs().slice(0, 80).map(r => '<option value="' + esc(r.title) + '">').join("");
}
function extSearch() {
  const q = $("#q").value.trim(); if (!q) return toast("Saisissez un mot-clé");
  const e = encodeURIComponent(q);
  const url = $("#qType").value === "juridique"
    ? "https://www.legifrance.gouv.fr/search/all?query=" + e
    : "https://www.google.com/search?q=" + encodeURIComponent(q + " incendie véhicule norme NF EN APSAD NFPA 921");
  window.open(url, "_blank", "noopener");
}
function netBadge() {
  const c = navigator.connection || {};
  let type = "";
  if (c.type === "wifi") type = "Wi-Fi";
  else if (c.type === "cellular") type = (c.effectiveType || "4g").toUpperCase() + "/5G";
  else if (c.effectiveType) type = c.effectiveType.toUpperCase();
  $("#netBadge").textContent = navigator.onLine ? "🟢 En ligne" + (type ? " · " + type : "") : "🟠 Hors ligne · mode local";
  $("#netBadge").className = "pill " + (navigator.onLine ? "ok" : "warn");
}
function syncBadge(ok) { $("#syncBadge").textContent = ok ? "☁️ Temps réel connecté" : "🔁 Reconnexion…"; $("#syncBadge").className = "pill " + (ok ? "ok" : "warn"); }
let btDevice = null;
async function btConnect() {
  if (!navigator.bluetooth) return toast("Bluetooth Web indisponible ici — utilisez Chrome Android ou l'APK.");
  try {
    btDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ["battery_service", "device_information"] });
    btDevice.addEventListener("gattserverdisconnected", () => { $("#btnBt").textContent = "🔵 Bluetooth"; toast("Bluetooth déconnecté"); });
    const gatt = await btDevice.gatt.connect();
    let label = btDevice.name || "Appareil";
    try {
      const svc = await gatt.getPrimaryService("battery_service");
      const ch = await svc.getCharacteristic("battery_level");
      label += " 🔋" + (await ch.readValue()).getUint8(0) + "%";
    } catch (e) {}
    $("#btnBt").textContent = "🔵 " + label;
    toast("Bluetooth connecté : " + label);
  } catch (err) { if (err && err.name !== "NotFoundError") toast("Bluetooth : " + err.message); }
}
let deferredPrompt = null, swReg = null, reloading = false;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; $("#btnInstall").hidden = false; });
window.addEventListener("DOMContentLoaded", () => {
  $("#gateForm").addEventListener("submit", e => {
    e.preventDefault();
    const n = $("#gateName").value.trim();
    if (n.length < 2) return toast("Prénom trop court");
    localStorage.setItem("eik-name", n); localStorage.setItem("eik-asked", "1");
    askAccess(n);
  });
  document.querySelectorAll(".reask").forEach(b => b.addEventListener("click", () => { $("#gateName").value = localStorage.getItem("eik-name") || ""; show("scrGate"); }));
  $("#btnAdmin").addEventListener("click", () => { if (isAdmin) { route(); return; } $("#adminPass").value = ""; show("scrLogin"); $("#adminPass").focus(); });
  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const ok = $("#adminPass").value === CONFIG.ADMIN_PASSWORD;
    $("#adminPass").value = "";                          // aucun point résiduel
    if (!ok) return toast("⛔ Mot de passe incorrect");
    isAdmin = true; sessionStorage.setItem("eik-admin", "1"); armLock(); route(); publishState(); toast("🛡️ Mode admin actif");
  });
  $("#btnLock").addEventListener("click", lockAdmin);
  $("#scrAdmin").addEventListener("pointerdown", () => { if (isAdmin) armLock(); });
  $("#reqList").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b || !isAdmin) return;
    const id = b.dataset.id, s = b.dataset.s;
    if (s === "del") delete state.devices[id];
    else if (state.devices[id]) state.devices[id].status = s;
    save(); publishState(); renderAdmin();
    toast(s === "del" ? "🗑️ Appareil supprimé" : "Statut : " + (LABEL[s] || s));
  });
  $("#btnOpenApp").addEventListener("click", () => { mountFrame(); show("scrApp"); });
  $("#wpFile").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    toast("⏳ Compression de l'image…");
    try {
      const img = await compress(f, 1600, 0.82);
      const opacity = parseFloat($("#wpOpacity").value);
      state.wp = { img: img, ts: Date.now(), opacity: opacity };
      save(); applyWp();
      const blob = await (await fetch(img)).blob();
      const url = await Sync.publishFile(blob, "fond.jpg");
      Sync.publish({ t: "wp", url: url, ts: state.wp.ts, opacity: opacity });
      toast("🖼️ Fond d'écran diffusé aux tiers en temps réel");
    } catch (err) { toast("Fond appliqué localement (diffusion impossible hors ligne)"); }
    e.target.value = "";
  });
  $("#wpOpacity").addEventListener("input", () => { if (state.wp) { state.wp.opacity = parseFloat($("#wpOpacity").value); save(); applyWp(); } });
  $("#wpClear").addEventListener("click", () => { state.wp = null; save(); applyWp(); Sync.publish({ t: "wpdel" }); toast("Fond retiré"); });
  $("#pubRef").addEventListener("click", () => {
    const title = $("#refTitle").value.trim(), url = $("#refUrl").value.trim();
    if (!title || !/^https?:\/\//i.test(url)) return toast("Titre + URL https:// requis");
    Sync.publish({ t: "ref", rid: crypto.randomUUID(), title: title, url: url, cat: $("#refCat").value, note: $("#refNote").value.trim().slice(0, 200), ts: Date.now() });
    $("#refTitle").value = $("#refUrl").value = $("#refNote").value = "";
    toast("📚 Référence publiée en temps réel");
  });
  $("#sendNotice").addEventListener("click", () => { const t = $("#noticeTxt").value.trim(); if (!t) return; Sync.publish({ t: "note", text: t.slice(0, 300) }); $("#noticeTxt").value = ""; });
  $("#q").addEventListener("input", renderRefs);
  $("#qType").addEventListener("change", renderRefs);
  $("#btnSearch").addEventListener("click", extSearch);
  $("#q").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); extSearch(); } });
  netBadge();
  window.addEventListener("online", netBadge); window.addEventListener("offline", netBadge);
  if (navigator.connection) navigator.connection.addEventListener("change", netBadge);
  $("#btnBt").addEventListener("click", btConnect);
  $("#btnInstall").addEventListener("click", async () => { if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; $("#btnInstall").hidden = true; } });
  if (CONFIG.APK_URL) { document.querySelectorAll(".apkLink").forEach(a => { a.href = CONFIG.APK_URL; a.hidden = false; }); }
  $("#btnUpdate").addEventListener("click", async () => { if (swReg) { await swReg.update(); toast("🔄 Vérification des mises à jour…"); } });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(r => { swReg = r; });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; location.reload(); } });
  }
  loadSeed(); applyWp(); route();
  Sync.init(onMsg, syncBadge);
  if (isAdmin) armLock();
  else Sync.publish({ t: "hello", id: myId });
});
