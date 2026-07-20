importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js");

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCD5vdIln1iYinVQFXptElpaW0z0bRC53E",
  authDomain: "webpush-d0066.firebaseapp.com",
  projectId: "webpush-d0066",
  storageBucket: "webpush-d0066.firebasestorage.app",
  messagingSenderId: "837126945537",
  appId: "1:837126945537:web:dfd79a0af664298466f900",
  measurementId: "G-MM6RY00D6T"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage(payload => {
  console.log("Background message received:", payload);

  // Show notification for data-only payloads to avoid duplicates
  if (payload.data && !payload.notification) {
    const title = payload.data.title || "SmartBin Alert";
    const body  = payload.data.body  || "Check your bin!";
    
    self.registration.showNotification(title, {
      body: body,
      icon: "/icon.png",
      tag : "smartbin-alert"
    });
  }
});

// Click action handler
self.addEventListener("notificationclick", event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
