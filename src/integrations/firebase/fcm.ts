import app from "./client";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { db } from "./client";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || "";

export async function registerAdminFcmToken(uid?: string) {
  if (!app) return;
  if (!VAPID_KEY) {
    console.warn("VAPID key not configured - push notifications will not work");
    return;
  }
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM not supported in this browser");
      return;
    }
    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) {
      console.warn("No FCM token available");
      return;
    }
    // store token in firestore for server to use
    try {
      await setDoc(doc(db, "fcm_tokens", currentToken), {
        token: currentToken,
        uid: uid || null,
        role: "admin",
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Failed to save FCM token to Firestore", e);
    }
    return currentToken;
  } catch (err) {
    console.warn("FCM registration failed", err);
  }
}

export function onForegroundMessage(handler: (payload: any) => void) {
  if (!app) return () => undefined;
  // Return a synchronous unsubscribe function. The actual setup is async
  // because `isSupported()` returns a Promise. We capture the real
  // unsubscribe when available and call it later.
  let unsubscribe: (() => void) | undefined = undefined;
  isSupported().then((supported) => {
    if (!supported) {
      console.warn("FCM not supported in this browser");
      return;
    }
    try {
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, handler as any) as unknown as () => void;
    } catch (e) {
      console.warn("onMessage setup failed", e);
    }
  }).catch((e) => console.warn("FCM isSupported() check failed", e));

  return () => {
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
    } catch (e) {
      /* ignore */
    }
  };
}

export default { registerAdminFcmToken, onForegroundMessage };
