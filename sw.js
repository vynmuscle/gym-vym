// Service worker clássico (não module) — Firefox ainda não suporta SW do tipo module.
// Bumpar CACHE_VERSION junto com APP_VERSION (js/config.js) sempre que JS/CSS/HTML mudar.
const CACHE_VERSION = 6;
const CACHE_NAME = `gymvym-v${CACHE_VERSION}`;

const CACHE_FIRST_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'raw.githubusercontent.com'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSupabaseOrApi(url) {
  return url.hostname.endsWith('.supabase.co') || url.pathname.startsWith('/api/');
}

function isCacheFirst(url) {
  return CACHE_FIRST_HOSTS.some(host => url.hostname.endsWith(host));
}

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (isSupabaseOrApi(url)) return;

  if (isCacheFirst(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
  }
});
