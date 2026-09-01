import { getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { messaging, db } from './firebaseConfig';

export async function registerForNotifications(
  role: 'admin' | 'tenant',
  roomId?: string
): Promise<string | null> {
  try {
    if (!('Notification' in window)) return null;

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

export function listenForForegroundMessages(callback: (title: string, body: string) => void) {
  onMessage(messaging, (payload) => {
    const title = payload.notification?.title || 'Voltra Tower';
    const body = payload.notification?.body || '';
    callback(title, body);
  });
}
