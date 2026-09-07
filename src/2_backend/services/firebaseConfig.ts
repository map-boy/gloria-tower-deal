import { initializeApp } from "firebase/app";
import { getMessaging, isSupported, Messaging } from "firebase/messaging";
import { initializeFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp = initializeApp(firebaseConfig);
// Messaging is not available in every browser (iOS Safari in private mode,
// older Android WebViews). Tenants open this on whatever phone they have, so
// asking for it must never take the whole app down.
let messagingPromise: Promise<Messaging | null> | null = null;
export function getMessagingIfSupported(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((ok) => (ok ? getMessaging(firebaseApp) : null))
      .catch(() => null);
  }
  return messagingPromise;
}
export const db = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true });
export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp);
