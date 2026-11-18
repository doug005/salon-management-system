/* Cache public display data and the app shell only; never private API responses. */
const SHELL_CACHE = 'salon-shell-v2';
const PUBLIC_CACHE = 'salon-public-v1';
const ASSETS = ['/', '/app.js', '/app.css', '/manifest.webmanifest', '/offline.html', '/offline-language.js', '/icon.svg', '/icon-192.png', '/icon-512.png'];
const ID = '[a-f\\d]{24}';
const PUBLIC_IMAGE = new RegExp(`^/api/public/(?:services/${ID}/image|professionals/${ID}/photo)$`, 'i');
const PUBLIC_PROFILE = new RegExp(`^/api/public/professionals/${ID}$`, 'i');
function isAllowedPublicData(url) {
  if (url.pathname === '/api/public/professionals' || url.pathname === '/api/public/settings' || url.pathname === '/api/public/advertisements')
    return [...url.searchParams.keys()].every((key) => ['page', 'limit', 'search', 'professional'].includes(key));
  if (url.pathname === '/api/public/services')
    return [...url.searchParams.keys()].every((key) => ['page', 'limit', 'search', 'professional'].includes(key));
  return PUBLIC_PROFILE.test(url.pathname);
}
async function keepPublicResponse(request, response) {
  if (!response.ok || response.type === 'opaque') return;
  const url = new URL(request.url);
  const image = PUBLIC_IMAGE.test(url.pathname);
  if (image && !response.headers.get('content-type')?.startsWith('image/')) return;
  if (!image && !response.headers.get('content-type')?.includes('application/json')) return;
  const cache = await caches.open(PUBLIC_CACHE);
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  if (keys.length > 100) await cache.delete(keys[0]);
}
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(async (keys) => {
    await Promise.all(keys.filter((key) => key.startsWith('salon-shell-') && key !== SHELL_CACHE || key.startsWith('salon-public-') && key !== PUBLIC_CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  }));
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (request.headers.has('authorization')) return;
    if (!PUBLIC_IMAGE.test(url.pathname) && !isAllowedPublicData(url)) return;
    event.respondWith(fetch(request).then(async (response) => {
      await keepPublicResponse(request, response);
      return response;
    }).catch(async () => (await caches.match(request, { cacheName: PUBLIC_CACHE })) || new Response(JSON.stringify({ message: 'This public information is not available offline yet.' }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html', { cacheName: SHELL_CACHE })) || (await caches.match('/', { cacheName: SHELL_CACHE }))));
    return;
  }
  if (!ASSETS.includes(url.pathname)) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(async () => (await caches.match(request, { cacheName: SHELL_CACHE })) || (request.mode === 'navigate' ? caches.match('/offline.html', { cacheName: SHELL_CACHE }) : undefined)));
});
