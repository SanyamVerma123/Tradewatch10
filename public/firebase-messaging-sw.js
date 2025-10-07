
// This file MUST be placed in your public folder and named 'firebase-messaging-sw.js'

// Import the required Firebase scripts using `importScripts`
// These specific versions use the older 'compat' API which works better 
// for the Service Worker global scope.
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.1.0/firebase-messaging-compat.js');

// 1. PASTE your FULL firebaseConfig object here again
const firebaseConfig = {
    apiKey: "AIzaSyD1I8B1nLBQFYqFGiXX5H6BkJbpgE9u-GE",
    authDomain: "stockwatch-618pq.firebaseapp.com",
    projectId: "stockwatch-618pq",
    storageBucket: "stockwatch-618pq.appspot.com",
    messagingSenderId: "359207349124",
    appId: "1:359207349124:web:cb2cd702cffff150fa0bd1",
};

// Initialize the Firebase app in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so it can handle background messages
const messaging = firebase.messaging();

// Handle incoming background messages (when the app is not in the foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  
  // Custom options for the notification
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: payload.data || {}, // Any custom data payload from the server
  };

  // Show the notification using the browser's Service Worker API
  self.registration.showNotification(notificationTitle, notificationOptions);
});
