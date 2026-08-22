/* Service Worker — JQ Ensayos App de Terreno
   Cachea el "cascarón" de la app (HTML, íconos, librerías) la primera vez
   que se abre con internet, para que luego funcione sin conexión en terreno. */

const CACHE_VERSION = 'jq-ensayos-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {
            /* Si un recurso externo falla al precachear (p.ej. sin internet
               en la instalación), la app igual sigue funcionando. */
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* Estrategia:
   - El documento HTML principal (index.html) va SIEMPRE a la red primero,
     así cualquier actualización se ve de inmediato con internet. Si no hay
     conexión, se usa la última copia guardada.
   - Los recursos pesados (íconos, librerías) usan cache-first con
     actualización en segundo plano, para velocidad y uso sin conexión. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isHTMLDocument =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document' ||
    event.request.url.endsWith('/index.html') ||
    event.request.url.endsWith('/');

  if (isHTMLDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
