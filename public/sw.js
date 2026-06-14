/**
 * Mise Fahrer Service Worker
 *
 * STRATEGIE: Network-First für alles außer /_next/static/ (content-hashed).
 * Dadurch gibt es NIE eine alte gecachte Seite — Updates sind sofort live.
 *
 * Phase 91: Offline-Bundle Caching
 * /api/delivery/driver/offline-bundle  → Stale-While-Revalidate (5 Min)
 * /api/delivery/driver/navigation       → Cache-First (15 Min TTL)
 */

const VERSION = 'v5-' + new Date().toISOString().slice(0, 10);
const STATIC_CACHE  = `mise-static-${VERSION}`;
const RUNTIME_CACHE = `mise-runtime-${VERSION}`;
const OFFLINE_CACHE = `mise-offline-${VERSION}`;

// Offline-Bundle Pfade — immer mit frischer Kopie im Cache vorhalten
const OFFLINE_BUNDLE_PATH = '/api/delivery/driver/offline-bundle';
const NAV_PATH            = '/api/delivery/driver/navigation';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE && k !== OFFLINE_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED', version: VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // /_next/static/ content-hashed → Cache-First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((res) => {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(event.request, clone));
          return res;
        })
      )
    );
    return;
  }

  // Phase 91: Offline-Bundle → Stale-While-Revalidate
  // Immer erst Cache zurückgeben, im Hintergrund aktualisieren
  if (url.pathname === OFFLINE_BUNDLE_PATH) {
    event.respondWith(
      caches.open(OFFLINE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }).catch(() => null);

        // Sofort aus Cache + Revalidate im Hintergrund
        if (cached) {
          event.waitUntil(fetchPromise);
          return cached;
        }
        // Kein Cache: warten auf Netzwerk
        const fresh = await fetchPromise;
        return fresh ?? new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Navigations-Route → Cache-First mit 15-Min TTL
  if (url.pathname === NAV_PATH) {
    event.respondWith(
      caches.open(OFFLINE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) {
          const dateHeader = cached.headers.get('date');
          const ageMs = dateHeader ? Date.now() - new Date(dateHeader).getTime() : Infinity;
          if (ageMs < 15 * 60 * 1000) return cached; // < 15 Min → Cache verwenden
        }
        return fetch(event.request).then((res) => {
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        }).catch(() => cached ?? new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }));
      })
    );
    return;
  }

  // Alles andere: NETWORK-FIRST, Offline-Fallback aus Runtime-Cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && (url.pathname.startsWith('/fahrer') || url.pathname === '/manifest.json')) {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(event.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ================= PUSH ================= */

self.addEventListener('push', (event) => {
  const data = (() => { try { return event.data?.json() ?? {}; } catch { return {}; } })();

  // Kunden-Push (type='customer') — leichtere Notification, kein requireInteraction
  if (data.type === 'customer') {
    const title = data.title || '📦 Bestellstatus';
    const options = {
      body: data.body || 'Deine Bestellung hat einen neuen Status.',
      icon: '/mise-icon-192.png',
      badge: '/mise-icon-192.png',
      tag: data.tag ?? 'mise-customer',
      renotify: true,
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: data.url ?? '/order/paid', time: Date.now(), type: 'customer' },
      actions: [
        { action: 'open', title: 'Tracking öffnen' },
        { action: 'dismiss', title: 'Schließen' },
      ],
    };
    event.waitUntil(self.registration.showNotification(title, options));
    return;
  }

  // Fahrer-Push (Standard)
  const title = data.title || '📦 Neue Tour';
  const options = {
    body: data.body || 'Bestellung fertig zum Abholen',
    icon: '/fahrer-icon-192.png',
    badge: '/fahrer-icon-192.png',
    tag: data.tag ?? 'mise-tour',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: { url: data.url ?? '/fahrer/app', time: Date.now() },
    actions: [
      { action: 'open', title: 'Öffnen' },
      { action: 'snooze', title: 'Später' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'snooze' || event.action === 'dismiss') return;
  const url = event.notification.data?.url ?? '/fahrer/app';
  const isCustomer = event.notification.data?.type === 'customer';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if (isCustomer && c.url.includes('/order') && 'focus' in c) return c.focus();
        if (!isCustomer && c.url.includes('/fahrer') && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CHECK_UPDATE') {
    self.registration.update();
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // Phase 91: Fahrer-App fordert Offline-Bundle-Prefetch an
  if (event.data?.type === 'PREFETCH_OFFLINE_BUNDLE') {
    caches.open(OFFLINE_CACHE).then((cache) =>
      fetch(OFFLINE_BUNDLE_PATH).then((res) => {
        if (res.ok) cache.put(OFFLINE_BUNDLE_PATH, res);
      }).catch(() => {})
    );
  }
});
