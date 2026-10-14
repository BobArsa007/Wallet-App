// Dompet service worker: offline app shell + Google Fonts cache.
// Bump CACHE when you want every installed copy to fully refresh.
const CACHE = 'dompet-v2';
const FONT_CACHE = 'dompet-fonts-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, CACHE, true));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, FONT_CACHE, false));
  }
});

// Serve from cache instantly, refresh the cache in the background.
async function staleWhileRevalidate(event, cacheName, navFallback) {
  const req = event.request;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });

  const network = fetch(req)
    .then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const res = await network;
  if (res) return res;

  if (navFallback && req.mode === 'navigate') {
    const shell = await cache.match('./index.html');
    if (shell) return shell;
  }
  return Response.error();
}
