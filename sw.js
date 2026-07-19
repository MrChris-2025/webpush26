self.addEventListener('push', function(event) {
    if (!event.data) return;
    
    try {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/default-sports-icon.png',
            badge: '/badge-icon.png',
            data: { url: data.url || '/' },
            tag: data.tag || 'score-update', // Overwrites previous toast if same match
            vibrate: [200, 100, 200]
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    } catch (e) {
        // Fallback for plain text push messages
        event.waitUntil(
            self.registration.showNotification('Sports Update', {
                body: event.data.text()
            })
        );
    }
});

// Handle notification click to open the app
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data.url)
    );
});
