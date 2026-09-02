// Piplantri Election PWA Service Worker (Network-First Strategy for Instant Live Updates)
const CACHE_NAME = 'piplantri-election-v6-war-room';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './linker.html',
  './contacts.html',
  './cloudSync.js',
  './data.js',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Mukta:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => console.log('Asset cache notice:', err));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-First with Cache Fallback for instant live updates
self.addEventListener('fetch', (event) => {
  // For external CDNs, use cache-first for performance
  if (event.request.url.includes('cdn.') || event.request.url.includes('unpkg.com') || event.request.url.includes('fonts.googleapis')) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // For app HTML and JS files, ALWAYS fetch from Network first so updates are immediate
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
