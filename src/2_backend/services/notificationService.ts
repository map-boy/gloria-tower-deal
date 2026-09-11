import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db, getMessagingIfSupported } from './firebaseConfig';

export async function registerForNotifications(
  role: 'admin' | 'recovery' | 'technician',
  roomId?: string
): Promise<string | null> {
  try {
    const messaging = await getMessagingIfSupported();
    if (!messaging || !('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await setDoc(doc(db, 'deviceTokens', token), {
        token,
        role,
        roomId: roomId || null,
        updatedAt: new Date().toISOString(),
      });
    }

    return token;
  } catch (e) {
    console.error('Failed to register for notifications', e);
    return null;
  }
}

// Returns an unsubscribe function; the listener attaches once messaging is
// known to work in this browser.
export function listenForForegroundMessages(
  callback: (title: string, body: string) => void
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;

  getMessagingIfSupported().then((messaging) => {
    if (!messaging || cancelled) return;
    unsub = onMessage(messaging, (payload) => {
      callback(
        payload.notification?.title || 'MIC Tower',
        payload.notification?.body || ''
      );
    });
  });

  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}
