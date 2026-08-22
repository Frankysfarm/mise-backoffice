/**
 * Mise Betreiber-Service-Worker
 * Scope: /neo/ — getrennt von Fahrer- und Kunden-Push.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { /* ignore malformed push */ }

  const options = {
    body: data.body || 'Im Betrieb gibt es eine neue Meldung.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'mise-owner',
    renotify: true,
    requireInteraction: data.urgent === true,
    data: { url: data.url || '/neo/app/uebersicht' },
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Mise', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/neo/app/uebersicht';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/neo/') && 'focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    }),
  );
});
