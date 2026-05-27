/**
 * Mise Kunden-Service-Worker
 * Handles Web Push für Bestell-Status-Updates auf Kundenseite.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore */ }

  const title = data.title || 'Bestellung-Update';
  const options = {
    body: data.body || 'Deine Bestellung wurde aktualisiert.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mise-order',
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100, 50, 100],
    actions: [
      { action: 'track', title: 'Status ansehen' },
      { action: 'unsubscribe', title: 'Stoppen' },
    ],
  };
  if (data.unsubscribe_token) options.data.unsubscribe_token = data.unsubscribe_token;
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'unsubscribe' && event.notification.data?.unsubscribe_token) {
    event.waitUntil(self.clients.openWindow(`/api/push/unsubscribe?t=${event.notification.data.unsubscribe_token}`));
    return;
  }
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
