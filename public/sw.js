/*
 * sw.js — Service Worker de Salud Digital (PWA).
 *
 * Diseño conservador para una app clínica con autenticación y datos sensibles:
 *   • NUNCA cachea /api/*          → siempre datos frescos, nada de PHI en disco.
 *   • NUNCA cachea /uploads/*      → fotos clínicas / PHI quedan solo en red.
 *   • Navegaciones (HTML)          → network-first con fallback a /offline.html.
 *   • Estáticos same-origin (js/css/img/fuentes) → stale-while-revalidate.
 *   • Cross-origin (CDNs, Cloudinary, tiles) → se deja pasar a la red.
 *
 * Para publicar una versión nueva del SW basta con cambiar CACHE_VERSION.
 * El servidor sirve /sw.js con Cache-Control: no-cache, así el navegador
 * detecta el cambio en la próxima visita.
 */
const CACHE_VERSION = 'sd-v2';
const PRECACHE = `${CACHE_VERSION}-precache`;
const RUNTIME = `${CACHE_VERSION}-runtime`;
const RUNTIME_MAX = 80; // tope blando de entradas en runtime (evita crecer sin límite)

// Recursos estables (sin ?v=) que sostienen el arranque y el modo offline.
const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/logo-mark.png',
  '/icons/favicon.ico',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(PRECACHE);
    // add() por recurso (no addAll) para que un fallo aislado no rompa el install.
    await Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u)));
    // NO se llama skipWaiting() aquí a propósito: en una actualización, el SW
    // nuevo espera a que se cierren las pestañas con el SW viejo, evitando
    // "version skew" (matar el SW anterior con requests clínicos en vuelo).
    // La página puede forzar la activación mandando postMessage('SKIP_WAITING').
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

// Permite que la página fuerce la activación inmediata del SW en espera.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // keys() conserva orden de inserción → borra las más antiguas.
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

function isStaticAsset(pathname) {
  return /\.(?:js|mjs|jsx|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|otf|json|webmanifest)$/i.test(pathname);
}

async function networkFirstNavigation(request) {
  try {
    // SIEMPRE red para navegaciones; el HTML autenticado NUNCA se cachea.
    // Esto evita dos riesgos en una app clínica: (1) servir la página de un
    // usuario a otro distinto en el mismo dispositivo cuando está sin conexión,
    // y (2) mostrar un shell viejo. Sin conexión → página offline de respaldo.
    return await fetch(request);
  } catch (_) {
    const offline = await caches.match('/offline.html');
    return offline || new Response('Sin conexión', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((resp) => {
      if (resp && resp.ok && resp.type === 'basic') {
        cache.put(request, resp.clone());
        trimCache(RUNTIME, RUNTIME_MAX);
      }
      return resp;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // mutaciones → siempre a la red

  let url;
  try { url = new URL(request.url); } catch (_) { return; }

  if (url.origin !== self.location.origin) return; // cross-origin → red directa
  if (url.pathname.startsWith('/api/')) return;     // API → nunca cache (datos / PHI)
  if (url.pathname.startsWith('/uploads/')) return; // archivos clínicos → nunca cache

  // Navegaciones de página reales. Se usa SOLO request.mode==='navigate' (todos
  // los navegadores con SW lo marcan así); NO se mira el header Accept: text/html
  // porque un fetch()/XHR same-origin podría incluirlo y terminaríamos tratando
  // como navegación una petición que no lo es.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Estáticos versionados (?v=) y assets en general → SWR.
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
