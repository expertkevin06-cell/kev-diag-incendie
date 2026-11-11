const CACHE = "eik-predictive-v46";
const DYN = "eik-dyn-v1";
const VERSION = "45.1.0";
const CORE = [
  "./", "./index.html", "./manifest.json",
  "./js/app.js", "./js/predictor.js", "./js/update-engine.js",
  "./data/pannes-connues.json", "./data/keywords.json", "./data/vehicles.json", "./data/engines.json", "./data/correlations.json", "./data/sources.json",
  "./images/icon.svg", "./404.html", "./offline.html",
  "./tools/verify.html", "./tools/icon-gen.html", "./tools/assetlinks.html"
];
const BYPASS_HOSTS = ["ntfy.sh", "ntfy.zoey.dev", "ntfy.tiepolog.ovh", "api.nhtsa.gov", "data.gouv.fr", "generativelanguage.googleapis.com", "auto-legal-by-kevin.lovable.app", "images.unsplash.com", "upload.wikimedia.org", "images.pexels.com"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url => {
      try { const r = await fetch(new Request(url, { cache: "reload" })); if (r.ok) await cache.put(url, r); } catch (e) {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE && k !== DYN).map(k => caches.delete(k)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "sw-activated", version: VERSION, cache: CACHE }));
  })());
});
self.addEventListener("message", event => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) return;
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;
  if (url.origin !== location.origin) return;
  if (event.request.mode === "navigate") { event.respondWith(networkFirst(event.request, true)); return; }
  if (url.pathname.endsWith(".json") || url.pathname.endsWith(".js") || url.pathname.endsWith(".html")) { event.respondWith(networkFirst(event.request, false)); return; }
  event.respondWith(cacheFirst(event.request));
});
async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE);
  try { const r = await fetch(request); if (r.ok) await cache.put(request, r.clone()); return r; }
  catch (e) {
    const direct = await cache.match(request, { ignoreSearch: true });
    if (direct) return direct;
    if (isNavigation) { const offline = await cache.match("./offline.html"); const home = await cache.match("./index.html") || await cache.match("./"); return offline || home || new Response("Hors ligne", { status: 503 }); }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
}
async function cacheFirst(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const cache = await caches.open(CACHE);
  try { const r = await fetch(request); if (r.ok) await cache.put(request, r.clone()); return r; }
  catch (e) { return new Response("", { status: 503 }); }
}
