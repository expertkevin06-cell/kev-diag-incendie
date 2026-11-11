/* SYNC — fichier croisé n°2 : SSE push + historique 12 h + file hors ligne + miroir multi-onglets */
const Sync = (() => {
  const BASE = CONFIG.NTFY_SERVER + "/" + CONFIG.NTFY_TOPIC;
  const seen = new Set();
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("eik-sync") : null;
  let es = null, onMsg = () => {}, onStatus = () => {};

  function deliver(p, mirror) {
    if (!p || !p.mid || seen.has(p.mid)) return;
    seen.add(p.mid);
    if (seen.size > 900) seen.delete(seen.values().next().value);
    onMsg(p);
    if (mirror && bc) bc.postMessage(p);
  }
  function queue() { try { return JSON.parse(localStorage.getItem("eik-queue")) || []; } catch (e) { return []; } }
  function setQueue(q) { localStorage.setItem("eik-queue", JSON.stringify(q.slice(-50))); }
  async function post(p) {
    const r = await fetch(BASE, { method: "POST", body: JSON.stringify(p) });
    if (!r.ok) throw new Error("HTTP " + r.status);
  }
  async function publish(obj) {
    const p = Object.assign({ mid: crypto.randomUUID(), ts: Date.now() }, obj);
    deliver(p, true);                                   // application locale immédiate
    if (!navigator.onLine) { const q = queue(); q.push(p); setQueue(q); return; }
    try { await post(p); } catch (e) { const q = queue(); q.push(p); setQueue(q); }
  }
  async function flush() {
    const q = queue(); setQueue([]);
    for (const p of q) { try { await post(p); } catch (e) { const r = queue(); r.push(p); setQueue(r); } }
  }
  async function publishFile(blob, filename) {          // fond d'écran en pièce jointe
    const r = await fetch(BASE, { method: "PUT", headers: { "X-Filename": filename }, body: blob });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    return j.attachment && j.attachment.url;
  }
  function connect() {
    if (es) es.close();
    es = new EventSource(BASE + "/sse");                // push temps réel
    es.onopen = () => onStatus(true);
    es.onerror = () => onStatus(false);                 // reconnexion automatique
    es.onmessage = ev => {
      try {
        const m = JSON.parse(ev.data);
        if (m.event === "message" && m.message) deliver(JSON.parse(m.message), true);
      } catch (e) {}
    };
  }
  async function replay() {                             // rattrape les 12 h manquées
    try {
      const r = await fetch(BASE + "/json?poll=1&since=12h");
      const txt = await r.text();
      txt.split("\n").forEach(line => {
        if (!line.trim()) return;
        try {
          const m = JSON.parse(line);
          if (m.event === "message" && m.message) deliver(JSON.parse(m.message), true);
        } catch (e) {}
      });
    } catch (e) {}
  }
  function init(msgCb, statusCb) {
    onMsg = msgCb; onStatus = statusCb;
    if (bc) bc.onmessage = e => deliver(e.data, false);
    window.addEventListener("online", () => { connect(); replay(); flush(); onStatus(true); });
    window.addEventListener("offline", () => onStatus(false));
    connect(); replay(); flush();
    setInterval(() => { if (es && es.readyState === 2) connect(); }, 30000); // watchdog
  }
  return { init, publish, publishFile };
})();
