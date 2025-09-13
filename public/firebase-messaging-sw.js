
// This file must be in the public directory
// so that it can be served at the root of the domain.

// Although we are not using the Firebase SDK in this file,
// this file is required for Firebase Cloud Messaging to work in the browser.
// Firebase will check for the existence of this file and handle it automatically.

// For demonstration, we can add simple listeners to show it's working.
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data.text()}"`);

  const title = 'StockWatch';
  const options = {
    body: event.data.text(),
    icon: '/icon.png', // Make sure you have an icon in your public folder
    badge: '/badge.png' // And a badge
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('https://google.com')
  );
});
