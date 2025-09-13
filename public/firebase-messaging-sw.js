// This file must be in the public directory.

// Scripts for Firebase
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1I8B1nLBQFYqFGiXX5H6BkJbpgE9u-GE",
  authDomain: "stockwatch-618pq.firebaseapp.com",
  projectId: "stockwatch-618pq",
  storageBucket: "stockwatch-618pq.appspot.com",
  messagingSenderId: "359207349124",
  appId: "1:359207349124:web:cb2cd702cffff150fa0bd1"
};


// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192x192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
