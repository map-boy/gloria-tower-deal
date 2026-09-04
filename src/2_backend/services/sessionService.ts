import { doc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Tunable safety valve. Firestore's free (Spark) tier caps at 50,000 reads/day
// and this app's listeners re-sync full collections on change, so this limit
// exists to protect the daily quota, not because of a hard connection cap.
export const MAX_CONCURRENT_SESSIONS = 50;
export const SESSION_HEARTBEAT_MS = 20000; // keep-alive ping while active
export const SESSION_TIMEOUT_MS = 60000; // stale session considered gone
export const IDLE_TIMEOUT_MS = 60000; // no user activity -> release slot

const sessionsRef = collection(db, 'activeSessions');

export interface SessionRecord {
  uid: string;
  email: string;
  lastHeartbeat?: Timestamp;
}

export function subscribeActiveSessions(callback: (sessions: SessionRecord[]) => void): () => void {
  return onSnapshot(sessionsRef, (snap) => {
    const now = Date.now();
    const active = snap.docs
      .map((d) => ({ uid: d.id, ...(d.data() as any) } as SessionRecord))
      .filter((s) => {
        const ts = s.lastHeartbeat?.toMillis ? s.lastHeartbeat.toMillis() : now;
        return now - ts < SESSION_TIMEOUT_MS;
      });
    callback(active);
  });
}

export async function claimSession(uid: string, email: string): Promise<void> {
  await setDoc(doc(db, 'activeSessions', uid), {
    email,
    lastHeartbeat: serverTimestamp(),
  });
}

export async function heartbeat(uid: string, email: string): Promise<void> {
  await setDoc(
    doc(db, 'activeSessions', uid),
    { email, lastHeartbeat: serverTimestamp() },
    { merge: true }
  );
}

export async function releaseSession(uid: string): Promise<void> {
  await deleteDoc(doc(db, 'activeSessions', uid));
}