/**
 * Mise Fahrer Service Worker
 *
 * STRATEGIE: Network-First für alles außer /_next/static/ (content-hashed).
 * Dadurch gibt es NIE eine alte gecachte Seite — Updates sind sofort live.
 */

const VERSION = 'v4-' + new Date().toISOString().slice(0, 10);
const STATIC_CACHE = `mise-static-${VERSION}`;
const RUNTIME_CACHE = `mise-runtime-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
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
  if (event.action === 'snooze') return;
  const url = event.notification.data?.url ?? '/fahrer/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes('/fahrer') && 'focus' in c) return c.focus();
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
});
