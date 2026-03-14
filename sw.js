// SPP LMP Dashboard — Service Worker
// Handles PWA install prompt; passes all network requests through unchanged.
// Data fetches (SPP proxy, CAISO, Open-Meteo) are always live — never cached.

const CACHE_NAME = 'lmp-shell-v1';
const SHELL_ASSETS = [
  '/SPP-LMP/',
  '/SPP-LMP/index.html'
];

// On install: cache the app shell
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// On activate: clean up old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch strategy:
// - Data APIs (proxy, caiso, open-meteo, anthropic) → always network, never cache
// - App shell → cache-first with network fallback
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // Always pass through live data requests
  if (url.includes('spp-proxy') ||
      url.includes('oasis.caiso') ||
      url.includes('open-meteo') ||
      url.includes('api.anthropic') ||
      url.includes('portal.spp.org') ||
      url.includes('codetabs') ||
      url.includes('corsproxy') ||
      url.includes('allorigins')) {
    return; // let browser handle normally
  }

  // App shell: cache-first
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request).then(function(response) {
        // Cache successful GET responses for shell assets only
        if (e.request.method === 'GET' && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      });
    }).catch(function() {
      // Offline fallback — return cached shell
      return caches.match('/SPP-LMP/index.html');
    })
  );
});
