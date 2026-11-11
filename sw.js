const CACHE = "eik-scientific-v41";
const DYN = "eik-dyn-v1";
const VERSION = "41.0.0";
const CORE = ["./","./index.html","./manifest.json","./js/app.js","./data/pannes-connues.json","./data/keywords.json","./images/icon.svg","./404.html"];
const BYPASS = ["ntfy.sh","ntfy.zoey.dev","ntfy.tiepolog.ovh","api.nhtsa.gov","data.gouv.fr","generativelanguage.googleapis.com","auto-legal-by-kevin.lovable.app","images.unsplash.com","upload.wikimedia.org","images.pexels.com"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async u => {
      try { const r = await fetch(new Request(u, { cache: "reload" })); if (r.ok) await c.put(u, r); } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k !== DYN).map(k => caches.delete(k)));
    await self.clients.claim();
    const cs = await self.clients.matchAll({ type: "window" });
    cs.forEach(c => c.postMessage({ type: "sw-activated", version: VERSION }));
  })());
});

self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || !u.protocol.startsWith("http")) return;
  if (BYPASS.some(h => u.hostname.includes(h))) return;
  if (u.origin !== location.origin) return;
  if (e.request.mode === "navigate") { e.respondWith(networkFirst(e.request, true)); return; }
  if (u.pathname.endsWith(".json") || u.pathname.endsWith(".js") || u.pathname.endsWith(".html")) { e.respondWith(networkFirst(e.request, false)); return; }
  e.respondWith(cacheFirst(e.request));
});

async function networkFirst(r, nav) {
  const c = await caches.open(CACHE);
  try {
    const s = await fetch(r);
    if (s.ok) await c.put(r, s.clone());
    return s;
  } catch (e) {
    const hit = await c.match(r, { ignoreSearch: true }) || await c.match("./index.html") || await c.match("./");
    return hit || new Response(nav ? "Hors ligne" : "[]", { status: nav ? 503 : 200, headers: { "Content-Type": nav ? "text/plain;charset=utf-8" : "application/json" } });
  }
}

async function cacheFirst(r) {
  const hit = await caches.match(r, { ignoreSearch: true });
  if (hit) return hit;
  const c = await caches.open(CACHE);
  try { const s = await fetch(r); if (s.ok) await c.put(r, s.clone()); return s; }
  catch (e) { return new Response("", { status: 503 }); }
}
