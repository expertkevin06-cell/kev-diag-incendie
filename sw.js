const CACHE = "eik-scientific-v1";
const DYN = "eik-dyn-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./js/app.js",
  "./data/pannes-connues.json",
  "./data/keywords.json",
  "./images/icon.svg",
  "./404.html"
];
const BYPASS = [
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

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async u => {
      try {
        const r = await fetch(u, { cache: "reload" });
        if (r.ok) await c.put(u, r);
      } catch (err) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k !== DYN).map(k => caches.delete(k)));
    await self.clients.claim();
    const cls = await self.clients.matchAll({ type: "window" });
    cls.forEach(cl => cl.postMessage({ type: "sw-activated", version: CACHE }));
  })());
});

self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data && e.data.type === "notify") {
    e.waitUntil(self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: "images/icon.svg",
      tag: e.data.tag || ("eik-" + Date.now())
    }));
  }
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    if (cs.length) return cs[0].focus();
    return clients.openWindow("./");
  }));
});

self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || !u.protocol.startsWith("http")) return;
  if (BYPASS.some(h => u.hostname.includes(h))) return;
  if (u.origin !== location.origin) {
    if (e.request.destination === "image") e.respondWith(img(e.request));
    return;
  }
  if (e.request.mode === "navigate") {
    e.respondWith(nav(e.request));
    return;
  }
  if (u.pathname.includes("/data/") && u.pathname.endsWith(".json")) {
    e.respondWith(dataNet(e.request));
    return;
  }
  e.respondWith(stat(e.request));
});

async function nav(r) {
  try {
    const s = await fetch(r);
    if (s.ok) {
      const c = await caches.open(CACHE);
      await c.put(r, s.clone());
    }
    return s;
  } catch (err) {
    return (await caches.match(r)) ||
      (await caches.match("./index.html")) ||
      (await caches.match("./")) ||
      new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain;charset=utf-8" } });
  }
}

async function dataNet(r) {
  const c = await caches.open(CACHE);
  try {
    const s = await fetch(r);
    if (s.ok) {
      await c.put(r, s.clone());
      return s;
    }
    throw new Error("bad response");
  } catch (err) {
    const cached = await c.match(r, { ignoreSearch: true });
    return cached || new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
}

async function stat(r) {
  const cached = await caches.match(r, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const s = await fetch(r);
    if (s.ok) {
      const c = await caches.open(CACHE);
      await c.put(r, s.clone());
    }
    return s;
  } catch (err) {
    return new Response("", { status: 503 });
  }
}

async function img(r) {
  const h = await caches.match(r);
  if (h) return h;
  try {
    const s = await fetch(r);
    if (s.ok || s.type === "opaque") {
      const c = await caches.open(DYN);
      await c.put(r, s.clone());
    }
    return s;
  } catch (err) {
    return new Response("", { status: 503 });
  }
}
