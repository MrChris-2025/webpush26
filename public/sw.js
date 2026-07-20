self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  // Parse the sports alert payload sent by your server
  const data = event.data.json(); 
  
  const options = {
    body: data.body, // e.g., "Touchdown! Chiefs 14, 49ers 7 (Q2)"
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png', // Small monochrome status bar icon
    vibrate: [200, 100, 200], // Haptic feedback for game updates
    data: { url: data.url || '/' }, // Deep link to game stats page
    tag: 'score-update-' + data.gameId, // Prevents duplicate notification spam
    renotify: true // Force device to vibrate/sound on every score update
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Open the game dashboard when the user clicks the notification
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
