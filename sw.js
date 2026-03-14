// ── SPP LMP Dashboard — Service Worker ──────────────────────────────────────
// index.html is always fetched fresh from network — no versioning needed.
// Just push index.html to GitHub and the app picks it up on next open.
const CACHE_NAME = 'spp-lmp-static-v1';

const STATIC_FILES = [
  '/SPP-LMP/manifest.json',
  '/SPP-LMP/icon-192.png',
  '/SPP-LMP/icon-512.png',
];

// ── Install: cache only static assets (not index.html) ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_FILES.filter(f => {
        // Only cache files that actually exist — silently skip missing ones
        return fetch(f).then(r => r.ok).catch(() => false);
      })))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up any old caches ───────────────────────────────────────
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

  // ── index.html: ALWAYS network-first, no caching ──
  // This means pushing a new index.html to GitHub is instantly picked up.
  if (url.pathname === '/SPP-LMP/' || url.pathname === '/SPP-LMP/index.html') {
    event.respondWith(
      fetch(event.request).catch(() =>
        // Offline fallback — serve whatever browser has cached natively
        caches.match(event.request)
      )
    );
    return;
  }

  // ── Data API calls: network only, never cache ──
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

  // ── Static assets (icons, manifest): cache-first ──
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
