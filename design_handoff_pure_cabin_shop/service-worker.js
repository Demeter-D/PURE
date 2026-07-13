// Minimal offline-shell service worker.
// Caches the app shell on install, serves from cache first, falls back to network.
// Bump CACHE_NAME whenever you ship a new deploy so old caches get cleared.

const CACHE_NAME = 'pure-shell-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  // add your built CSS/JS bundle paths here, e.g. '/assets/app.js', '/assets/app.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Never cache API/checkout calls — always go to network for those.
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Optionally cache new same-origin GET requests as you go.
        if (event.request.method === 'GET' && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
