const CACHE_NAME = 'espn-pwa-v2';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Real background Push Event listener waking up Service Worker
self.addEventListener('push', (event) => {
  let data = { title: 'Score Update', body: 'New game activity!' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://hcforever.nekoweb.org/mo2.png',
    badge: data.badge || 'https://hcforever.nekoweb.org/mo2.png',
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle tap on system notification banner
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
