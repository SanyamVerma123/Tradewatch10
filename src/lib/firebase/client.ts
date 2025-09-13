
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyD1I8B1nLBQFYqFGiXX5H6BkJbpgE9u-GE",
  authDomain: "stockwatch-618pq.firebaseapp.com",
  projectId: "stockwatch-618pq",
  storageBucket: "stockwatch-618pq.appspot.com",
  messagingSenderId: "359207349124",
  appId: "1:359207349124:web:cb2cd702cffff150fa0bd1"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const messaging = (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_VAPID_KEY) ? getMessaging(app) : null;

export { app, messaging };

