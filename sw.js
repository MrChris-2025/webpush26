// sw.js - Root Directory Service Worker Engine

self.addEventListener('install', (event) => {
    // Force immediate activation when updated
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Listener for local app tracking simulation updates
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const title = event.data.title;
        const options = {
            body: event.data.body,
            icon: event.data.icon || 'https://a.espncdn.com/favicon.ico',
            badge: 'https://a.espncdn.com/favicon.ico',
            vibrate: [100, 50, 100],
            data: { url: self.location.origin }
        };
        
        event.waitUntil(
            self.registration.showNotification(title, options)
        );
    }
});

// Handle clicking on the banner notification layout 
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow(event.notification.data.url || '/');
        })
    );
});
