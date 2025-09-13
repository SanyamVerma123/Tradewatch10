
// This file must be in the public directory.

// In a real production app, you would want to version your service worker
// and manage updates carefully.

// Import and initialize the Firebase SDK
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// IMPORTANT: This config must be filled out.
// It is safe to expose this config to the public.
const firebaseConfig = {
  apiKey: "AIzaSyD1I8B1nLBQFYqFGiXX5H6BkJbpgE9u-GE",
  authDomain: "stockwatch-618pq.firebaseapp.com",
  projectId: "stockwatch-618pq",
  storageBucket: "stockwatch-618pq.appspot.com",
  messagingSenderId: "359207349124",
  appId: "1:359207349124:web:cb2cd702cffff150fa0bd1"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// This is the background message handler.
// It will be triggered when the app is in the background or closed.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


// Optional: Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // This example focuses the user on the existing tab if it's open,
  // or opens a new one if it's not.
  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
