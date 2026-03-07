import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: any = null;
export let auth: any = null;
export let db: any = null;
export let storage: any = null;

const hasApiKey = typeof firebaseConfig.apiKey === "string" && firebaseConfig.apiKey.length > 5;
if (!hasApiKey) {
  // Friendly warning for missing config — prevents immediate crash and shows clear guidance in console
  // The real fix is to add env vars (VITE_FIREBASE_API_KEY etc.) in a local .env file and restart Vite.
  // Example .env.local content:
  // VITE_FIREBASE_API_KEY=...
  // VITE_FIREBASE_AUTH_DOMAIN=...
  // VITE_FIREBASE_PROJECT_ID=...
  // VITE_FIREBASE_STORAGE_BUCKET=...
  // VITE_FIREBASE_MESSAGING_SENDER_ID=...
  // VITE_FIREBASE_APP_ID=...
  console.error("Firebase config is missing or invalid. Set VITE_FIREBASE_* env vars and restart the dev server.");
} else {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

export default app;
