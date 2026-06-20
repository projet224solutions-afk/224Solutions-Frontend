const CACHE_VERSION = '__SW_VERSION__';
const STATIC_CACHE = `224solutions-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `224solutions-runtime-${CACHE_VERSION}`;
const APP_SHELL_CACHE = `224solutions-app-shell-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline.html';
const APP_SHELL_URL = '/index.html';

let firebaseAvailable = false;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');
  firebaseAvailable = true;
} catch (e) {
  console.warn('[FCM SW] Firebase scripts non chargés', e);
}

let firebaseConfig = null;
let fcmInitialized = false;

function initFCM() {
  if (fcmInitialized || !firebaseAvailable || !firebaseConfig) return;

  try {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || 'Nouvelle notification';
      const isCall = payload.data?.type === 'incoming_call';

      self.registration.showNotification(title, {
        body: payload.notification?.body || '',
        icon: '/icon-192.png',
        badge: '/favicon.png',
        // Un appel garde un tag fixe (remplace la notif précédente) ; sinon par id
        tag: isCall ? 'incoming_call' : (payload.data?.notification_id || 'default'),
        data: payload.data || {},
        // Appel : reste affiché jusqu'à action, vibration de sonnerie, priorité haute
        requireInteraction: isCall,
        renotify: isCall,
        vibrate: isCall ? [400, 200, 400, 200, 400] : [200, 100, 200],
        actions: isCall
          ? [{ action: 'answer', title: 'Répondre' }, { action: 'decline', title: 'Refuser' }]
          : undefined,
      });
    });

    fcmInitialized = true;
    console.log('[FCM SW] Initialisé');
  } catch (error) {
    console.error('[FCM SW] Erreur init:', error);
  }
}

const PRECACHE_ASSETS = [
  '/',
  APP_SHELL_URL,
  '/manifest.webmanifest?v=3',
  OFFLINE_URL,
  '/favicon.png?v=3',
  '/apple-touch-icon.png?v=3',
  '/icon-192.png?v=3',
  '/icon-512.png?v=3',
];

async function fetchWithTimeout(resource, timeout = 8000, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(resource, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok) return;

  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (error) {
    console.warn('[SW] Cache put failed:', error);
  }
}

async function deleteOldCaches() {
  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => {
        if (!key.startsWith('224solutions-')) return false;
        return !key.includes(CACHE_VERSION);
      })
      .map((key) => {
        console.log('[SW] Delete old cache:', key);
        return caches.delete(key);
      })
  );
}

async function clear224Caches() {
  const keys = await caches.keys();

  await Promise.all(
    keys
      .filter((key) => key.startsWith('224solutions-'))
      .map((key) => caches.delete(key))
  );
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });

  for (const client of clients) {
    client.postMessage(message);
  }
}

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isBypassRequest(url) {
  return (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/healthz.json' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/~oauth') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/') ||
    url.pathname.startsWith('/storage/')
  );
}

function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/') && /\.(js|css)$/.test(url.pathname);
}

function isMediaAsset(url) {
  return /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/i.test(url.pathname);
}

async function getOfflineFallback() {
  const cached = await caches.match(OFFLINE_URL);
  if (cached) return cached;

  return new Response(
    '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f5f5f5;margin:0"><div style="text-align:center;max-width:400px;padding:40px"><div style="font-size:60px;margin-bottom:16px">📡</div><h1 style="margin-bottom:12px">Mode Hors Ligne</h1><p style="color:#666;margin-bottom:24px">Connexion Internet requise pour charger l’application.</p><button onclick="location.reload()" style="padding:12px 24px;background:#023288;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer">Réessayer</button></div><script>window.addEventListener("online",()=>location.reload())</script></body></html>',
    {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

async function precacheShell() {
  console.log(`[SW ${CACHE_VERSION}] Precaching shell...`);

  await Promise.allSettled(
    PRECACHE_ASSETS.map(async (url) => {
      try {
        const response = await fetchWithTimeout(url, 10000, { cache: 'no-cache' });
        if (response.ok) {
          await safeCachePut(STATIC_CACHE, url, response.clone());
        }
      } catch (error) {
        console.warn(`[SW] Skip ${url}:`, error?.message || error);
      }
    })
  );

  try {
    const response = await fetchWithTimeout(APP_SHELL_URL, 12000, { cache: 'no-cache' });

    if (!response?.ok) return;

    await safeCachePut(APP_SHELL_CACHE, '/', response.clone());
    await safeCachePut(APP_SHELL_CACHE, APP_SHELL_URL, response.clone());
    await safeCachePut(STATIC_CACHE, APP_SHELL_URL, response.clone());

    const html = await response.text();

    const assetUrls = [
      ...new Set(
        Array.from(
          html.matchAll(/(?:href|src)=["'](\/assets\/[^"']+)["']/g)
        ).map((m) => m[1])
      ),
    ].filter((url) => /\.(js|css)$/i.test(url));

    await Promise.allSettled(
      assetUrls.map(async (assetUrl) => {
        try {
          const assetResponse = await fetchWithTimeout(assetUrl, 15000, {
            cache: 'no-cache',
          });

          if (assetResponse.ok) {
            await safeCachePut(STATIC_CACHE, assetUrl, assetResponse.clone());
          }
        } catch (error) {
          console.warn(`[SW] Asset skip ${assetUrl}:`, error?.message || error);
        }
      })
    );

    console.log(`[SW] Cached ${assetUrls.length} build assets`);
  } catch (error) {
    console.warn('[SW] Shell precache failed:', error?.message || error);
  }
}

async function handleNavigationRequest(event) {
  // CHEMIN RAPIDE HORS LIGNE : si l'appareil est hors ligne, on sert DIRECTEMENT l'app shell en cache
  // (aucune tentative réseau) → ouverture/navigation instantanée du vendeur sans connexion.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineShell =
      (await caches.match('/')) ||
      (await caches.match(APP_SHELL_URL)) ||
      (await caches.open(APP_SHELL_CACHE).then((cache) => cache.match('/'))) ||
      (await caches.open(APP_SHELL_CACHE).then((cache) => cache.match(APP_SHELL_URL)));
    if (offlineShell) return offlineShell;
    // Pas de shell en cache (jamais ouvert en ligne) → page d'info hors ligne.
    return getOfflineFallback();
  }

  try {
    const networkResponse = await fetchWithTimeout(event.request, 12000, {
      cache: 'no-cache',
      credentials: 'same-origin',
    });

    if (networkResponse?.ok) {
      const contentType = networkResponse.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        const clone = networkResponse.clone();

        await safeCachePut(RUNTIME_CACHE, event.request, clone.clone());

        // On garde le shell principal propre uniquement si la réponse
        // correspond au shell SPA attendu.
        if (
          new URL(event.request.url).pathname === '/' ||
          new URL(event.request.url).pathname === APP_SHELL_URL
        ) {
          await safeCachePut(APP_SHELL_CACHE, '/', clone.clone());
          await safeCachePut(APP_SHELL_CACHE, APP_SHELL_URL, clone.clone());
        }
      }
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] Navigation network failed:', error?.message || error);

    const cachedResponse =
      (await caches.match(event.request)) ||
      (await caches.match('/')) ||
      (await caches.match(APP_SHELL_URL)) ||
      (await caches.open(APP_SHELL_CACHE).then((cache) => cache.match('/'))) ||
      (await caches.open(APP_SHELL_CACHE).then((cache) => cache.match(APP_SHELL_URL)));

    if (cachedResponse) return cachedResponse;

    return getOfflineFallback();
  }
}

async function handleStaticAssetRequest(event) {
  try {
    const response = await fetchWithTimeout(event.request, 15000, {
      cache: 'no-cache',
    });

    if (response.ok) {
      event.waitUntil(safeCachePut(STATIC_CACHE, event.request, response.clone()));
      return response;
    }

    if (response.status === 404) {
      event.waitUntil(
        (async () => {
          await clear224Caches();
          await notifyClients({
            type: 'SW_ASSET_404',
            message: 'Un nouveau déploiement a été détecté. Rechargement en cours...',
            url: event.request.url,
          });
          // Force reload all open tabs to pick up the new deploy
          const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const client of allClients) {
            if ('navigate' in client) client.navigate(client.url);
          }
        })()
      );
      // Return empty JS to avoid script error while reload is triggered
      return new Response('/* deploy update — reloading */', {
        headers: { 'Content-Type': 'application/javascript' },
      });
    }

    return response;
  } catch (error) {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    event.waitUntil(
      (async () => {
        await clear224Caches();
        await notifyClients({
          type: 'SW_HARD_REFRESH_REQUIRED',
          message: 'Les fichiers de build ont changé. Rechargement en cours...',
          url: event.request.url,
        });
        // Force reload all open tabs
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          if ('navigate' in client) client.navigate(client.url);
        }
      })()
    );

    // Return empty JS to avoid script error during forced reload
    return new Response('/* deploy update — reloading */', {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
}

async function handleMediaAssetRequest(event) {
  const cached = await caches.match(event.request);

  const networkFetch = (async () => {
    try {
      const response = await fetchWithTimeout(event.request, 10000);

      if (response?.ok) {
        event.waitUntil(safeCachePut(STATIC_CACHE, event.request, response.clone()));
      }

      return response;
    } catch (error) {
      if (cached) return cached;

      if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(new URL(event.request.url).pathname)) {
        return new Response(
          '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="#ddd" width="200" height="200"/><text fill="#999" x="50%" y="50%" text-anchor="middle" dy=".3em">Offline</text></svg>',
          { headers: { 'Content-Type': 'image/svg+xml' } }
        );
      }

      return Response.error();
    }
  })();

  // stale-while-revalidate
  return cached || networkFetch;
}

self.addEventListener('install', (event) => {
  console.log(`[SW] Install ${CACHE_VERSION}`);
  event.waitUntil(
    (async () => {
      await precacheShell();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate ${CACHE_VERSION}`);
  event.waitUntil(
    (async () => {
      await deleteOldCaches();
      await self.clients.claim();
      await notifyClients({
        type: 'SW_ACTIVATED',
        version: CACHE_VERSION,
      });
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (!isSameOrigin(url)) return;
  if (isBypassRequest(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(handleStaticAssetRequest(event));
    return;
  }

  if (isMediaAsset(url)) {
    event.respondWith(handleMediaAssetRequest(event));
    return;
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }

  if (event.data === 'forceRefresh') {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => client.navigate(client.url));
    });
    return;
  }

  if (event.data?.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    initFCM();
    return;
  }

  if (event.data === 'clearAllCaches') {
    event.waitUntil?.(clear224Caches());
    clear224Caches();
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    event.waitUntil(
      self.registration.showNotification(data.title || '224Solutions', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/favicon.png',
        data: data.data || {},
        tag: data.tag || 'default',
        vibrate: [200, 100, 200],
      })
    );
  } catch (error) {
    console.warn('[SW] Push parse error:', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  // "Refuser" un appel : ne pas ouvrir l'app
  if (event.action === 'decline') return;

  const urlToOpen = data.url || data.action_url || '/';

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clients) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ('navigate' in client) {
            await client.navigate(urlToOpen);
          }
          return;
        }
      }

      return self.clients.openWindow(urlToOpen);
    })()
  );
});

self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
});

console.log(`[SW] Service Worker chargé (${CACHE_VERSION})`);
