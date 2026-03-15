// ── SPP LMP Dashboard — Service Worker ──────────────────────────────────────
// Bump CACHE_NAME version whenever icons or manifest change to force refresh.
const CACHE_NAME = 'spp-lmp-static-v2';

const STATIC_FILES = [
  '/SPP-LMP/manifest.json',
  '/SPP-LMP/icon-192x192.png',
  '/SPP-LMP/icon-512x512.png',
];

// ── Install: cache static assets ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        STATIC_FILES.map(f => fetch(f).then(r => r.ok ? cache.put(f, r) : null).catch(()=>null))
      ))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: delete ALL old caches ─────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch strategy ───────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // index.html: always network-first
  if (url.pathname === '/SPP-LMP/' || url.pathname === '/SPP-LMP/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Data API calls: network only
  const isDataCall =
    url.hostname.includes('spp.org')        ||
    url.hostname.includes('corsproxy.io')   ||
    url.hostname.includes('allorigins.win') ||
    url.hostname.includes('codetabs.com')   ||
    url.hostname.includes('workers.dev')    ||
    url.hostname.includes('open-meteo.com');

  if (isDataCall) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets (icons, manifest): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
