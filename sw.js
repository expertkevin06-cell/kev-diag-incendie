/* service-worker.js — v32 : anti-404, purge des anciens caches, fonctions v31 conservées */
const CACHE = 'etude-v33', DYN = 'etude-dyn-v31';
const CORE = ['./','./index.html','./manifest.json','./css/styles.css','./js/data.js','./js/engine.js','./js/search-v25.js','./js/mega-pannes.js','./js/legal-auto.js','./js/app.js','./js/fiches-techniques.js','./images/icon.svg','./data/recalls-feed.json','./js/kevin-pro.js','./css/kevin-pro.css','./data/keywords.json'];
const BYPASS = ['generativelanguage.googleapis.com','ntfy.sh','ntfy.zoey.dev','ntfy.tiepolog.ovh','api.nhtsa.gov','data.gouv.fr','auto-legal-by-kevin.lovable.app','images.unsplash.com','upload.wikimedia.org','images.pexels.com','image.qwenlm.ai'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.allSettled(CORE.map(async u => {
      try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (err) {}
    }));
    self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE && k !== DYN).map(k => caches.delete(k)));
    await self.clients.claim();
    const cls = await self.clients.matchAll({ type: 'window' });
    cls.forEach(cl => cl.postMessage({ type: 'sw-activated', version: CACHE }));
  })());
});
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'notify') {
    e.waitUntil(self.registration.showNotification(e.data.title, {
      body: e.data.body, icon: 'images/icon-192x192.png', tag: e.data.tag || ('ac-' + Date.now())
    }));
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    if (cs.length) cs[0].focus(); else clients.openWindow('./');
  }));
});
self.addEventListener('periodicsync', e => {
  if (e.tag === 'monthly-recalls') {
    e.waitUntil((async () => {
      try {
        const res = await fetch('data/recalls-feed.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) return;
        const feed = await res.json();
        const c = await caches.open(DYN);
        await c.put('data/recalls-feed.json', new Response(JSON.stringify(feed)));
        const cls = await self.clients.matchAll({ type: 'window' });
        cls.forEach(cl => cl.postMessage({ type: 'feed-updated', version: feed.version }));
      } catch (err) {}
    })());
  }
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (!u.protocol.startsWith('http')) return;
  if (BYPASS.some(h => u.hostname.includes(h))) { e.respondWith(net(e.request)); return; }
  if (u.origin === location.origin) {
    e.respondWith(e.request.mode === 'navigate' ? nav(e.request) : stat(e.request));
    return;
  }
  if (e.request.destination === 'image') { e.respondWith(img(e.request)); }
});
async function nav(r) {
  try {
    const s = await fetch(r);
    if (s.ok) { const c = await caches.open(CACHE); c.put(r, s.clone()); }
    return s;
  } catch (err) {
    return (await caches.match(r)) || (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
  }
}
async function stat(r) {
  const h = await caches.match(r, { ignoreSearch: true });
  if (h) return h;
  try {
    const s = await fetch(r);
    if (s.ok) { const c = await caches.open(CACHE); c.put(r, s.clone()); }
    return s;
  } catch (err) { return new Response('', { status: 503 }); }
}
async function net(r) {
  try {
    const s = await fetch(r);
    if (s.ok) { const c = await caches.open(DYN); c.put(r, s.clone()); }
    return s;
  } catch (err) { return (await caches.match(r)) || new Response('{}', { status: 503 }); }
}
async function img(r) {
  const h = await caches.match(r);
  if (h) return h;
  try {
    const s = await fetch(r);
    if (s.ok || s.type === 'opaque') { const c = await caches.open(DYN); c.put(r, s.clone()); }
    return s;
  } catch (err) { return new Response('', { status: 503 }); }
}
