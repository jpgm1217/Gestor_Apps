const CACHE = 'gomez-hub-v1';

const PRECACHE = [
  '/GestorApps.html',
  '/apps/App_Deudas.html',
  '/apps/App_GastosHogar.html',
  '/apps/App_Gastos_Personales.html',
  '/apps/App_AdminPrestamos.html',
  '/apps/App_Cobrar.html',
  '/apps/App_LiquidacionCarro.html'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
