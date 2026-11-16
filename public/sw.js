const CACHE = 'mealy-shell-v5';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add('./')).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      void caches.open(CACHE).then(cache => cache.put('./', copy));
      return response;
    }).catch(() => caches.match('./')));
    return;
  }
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
