// public/sw.js
const VERSION = 'v1';
const PAGES = `ck-pages-${VERSION}`;
const STATIC = `ck-static-${VERSION}`;
const ASSETS = `ck-assets-${VERSION}`;
const KEEP = [PAGES, STATIC, ASSETS];

// Pages mises en cache dès la première visite
const PRECACHE = ['/', '/notes', '/groupes', '/admin', '/login', '/offline.html', '/logo.png', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) =>
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// L'app propose la mise à jour, puis demande l'activation
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > max) {
    await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
  }
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      (r) => {
        clearTimeout(t);
        resolve(r);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

// Pages : réseau d'abord. Si le réseau est lent (4 s) ou absent, on sert la copie du téléphone.
async function networkFirstPage(req) {
  const cache = await caches.open(PAGES);
  const cached = await cache.match(req, { ignoreSearch: true });
  try {
    const res = await (cached ? fetchWithTimeout(req, 4000) : fetch(req));
    if (res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  } catch {
    return cached || (await caches.match('/offline.html')) || Response.error();
  }
}

// Fichiers /_next/static : jamais modifiés (nom unique), donc cache d'abord
async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone());
    trim(name, 150);
  }
  return res;
}

// Images, polices, styles : on sert la copie et on rafraîchit en arrière-plan
async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') {
        cache.put(req, res.clone());
        trim(name, 80);
      }
      return res;
    })
    .catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Polices Google
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
    return;
  }

  // Tout le reste hors de notre domaine (dont Supabase) passe directement, jamais mis en cache
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }

  if (['image', 'font', 'style', 'script'].includes(req.destination) || url.pathname === '/manifest.json') {
    event.respondWith(staleWhileRevalidate(req, ASSETS));
  }
});
