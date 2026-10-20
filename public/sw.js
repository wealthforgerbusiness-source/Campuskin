// CampusKin — service worker : pages réseau d'abord, fichiers statiques en cache, jamais l'API ni Supabase.
const CACHE = 'campuskin-v2';
const PRECACHE = ['/', '/offline.html', '/assets/css/base.css', '/assets/css/landing.css', '/assets/css/auth.css', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Pages : réseau d'abord, page hors ligne en secours
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // Fichiers statiques : cache d'abord, mise à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((cached) => {
      const frais = fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || frais;
    })
  );
});
