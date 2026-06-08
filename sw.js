// VitalPath Service Worker — v1.3
const CACHE_NAME = 'vitalpath-v4';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/index.html']).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept requests to other origins (Supabase, Google, APIs, fonts)
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Never serve cached response when URL has OAuth params in hash or query
  // — always let the real page load so Supabase SDK can parse the tokens
  const hasOAuthParams =
    url.hash.includes('access_token') ||
    url.hash.includes('error=') ||
    url.searchParams.has('code') ||
    url.searchParams.has('error');

  if (hasOAuthParams) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else (same-origin static assets)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
