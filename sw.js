const CACHE = "eik-scientific-v42";
const DYN = "eik-dyn-v1";
const VERSION = "42.0.0";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/app.js",
  "./js/update-engine.js",
  "./data/pannes-connues.json",
  "./data/keywords.json",
  "./data/sources.json",
  "./images/icon.svg",
  "./404.html",
  "./offline.html",
  "./tools/verify.html",
  "./tools/icon-gen.html",
  "./tools/assetlinks.html"
];
const BYPASS_HOSTS = [
  "ntfy.sh",
  "ntfy.zoey.dev",
  "ntfy.tiepolog.ovh",
  "api.nhtsa.gov",
  "data.gouv.fr",
  "generativelanguage.googleapis.com",
  "auto-legal-by-kevin.lovable.app",
  "images.unsplash.com",
  "upload.wikimedia.org",
  "images.pexels.com"
];
const BYPASS_PATHS = ["/techkevin2026/", "/auto-diagnostic/"];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async url => {
      try {
        const response = await fetch(new Request(url, { cache: "reload" }));
        if (response.ok) await cache.put(url, response);
      } catch (error) {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE && key !== DYN).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(client => client.postMessage({ type: "sw-activated", version: VERSION, cache: CACHE }));
  })());
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "notify") {
    event.waitUntil(self.registration.showNotification(event.data.title || "Étude incendie", {
      body: event.data.body || "",
      icon: "images/icon.svg",
      badge: "images/icon.svg",
      tag: event.data.tag || ("eik-" + Date.now())
    }));
  }
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow("./");
  }));
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !url.protocol.startsWith("http")) return;
  if (BYPASS_HOSTS.some(host => url.hostname.includes(host))) return;
  if (url.origin !== location.origin) return;
  if (BYPASS_PATHS.some(path => url.pathname.startsWith(path))) return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request, true));
    return;
  }
  if (url.pathname.endsWith(".json") || url.pathname.endsWith(".js") || url.pathname.endsWith(".html")) {
    event.respondWith(networkFirst(event.request, false));
    return;
  }
  event.respondWith(cacheFirst(event.request));
});

async function networkFirst(request, isNavigation) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const direct = await cache.match(request, { ignoreSearch: true });
    if (direct) return direct;
    if (isNavigation) {
      const offline = await cache.match("./offline.html");
      const home = await cache.match("./index.html") || await cache.match("./");
      return offline || home || new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain;charset=utf-8" } });
    }
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

async function cacheFirst(request) {
  const hit = await caches.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    return new Response("", { status: 503 });
  }
}
