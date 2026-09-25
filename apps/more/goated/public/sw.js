// Minimal service worker for the GOATED n-Back PWA.
//
// Goal: make the app installable (Chrome / Edge / Android require a SW that
// handles fetch for the install prompt to fire) and let it open offline once
// the user has loaded it at least once. We use a cache-first strategy for
// the app shell + same-origin static assets, and network-first for HTML so
// updates ship quickly when the user re-opens the app online.

const VERSION = 'v3';
const SHELL_CACHE = `goated-nback-shell-${VERSION}`;
const RUNTIME_CACHE = `goated-nback-runtime-${VERSION}`;

// The shell is whatever's needed to render the first frame offline. We use
// relative paths so this works on any GitHub Pages subpath without rewrite.
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL).catch(() => {
      // If any of the shell URLs miss (e.g. icon not yet built on first
      // deploy), don't abort install — fall through and let runtime caching
      // pick them up later.
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only handle GET — never cache POSTs / range requests / etc.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only cache same-origin assets. Cross-origin (fonts, telemetry) is
  // passed straight to the network.
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first so users always get the latest HTML
  // when online, but fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Static asset: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
        return response;
      }).catch(() => cached);
    })
  );
});

// Allow the page to ask the SW to swap to a freshly-installed version
// without waiting for all tabs to close.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
