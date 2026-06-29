/* Sismos Venezuela — Service Worker */
const VERSION    = 'v1_6';
const CACHE_NAME = 'sismos-ve-' + VERSION;

const URLS_TO_CACHE = ['./', './index.html'];
const URLS_OPTIONAL = ['./manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(URLS_TO_CACHE);
      await Promise.allSettled(
        URLS_OPTIONAL.map(u => cache.add(u).catch(e => console.warn('[SW] No cacheado:', u, e.message)))
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event && event.data ? event.data : null;
  if (!data) return;
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'GET_VERSION') {
    try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ type: 'VERSION', version: VERSION }); }
    catch(e) {}
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // No cachear APIs externas — siempre frescos
  const bypass = [
    'earthquake.usgs.gov', 'sismosve.rafnixg.dev',
    'allorigins.win', 'corsproxy.io',
    'tile.openstreetmap.org', 'unpkg.com',
    'fonts.googleapis.com', 'fonts.gstatic.com',
    'analysis.windows.net'  // Power BI FUNVISIS
  ];
  if (bypass.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(req).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Shell: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        try {
          if (url.origin === self.location.origin) {
            caches.open(CACHE_NAME).then(c => c.put(req, resp.clone())).catch(() => {});
          }
        } catch(e) {}
        return resp;
      });
    })
  );
});
