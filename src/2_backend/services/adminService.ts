import { collection, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebaseConfig';
import { BOOTSTRAP_ADMIN_EMAILS } from './authService';

export interface AdminEntry {
  email: string;
  builtIn: boolean;      // built-in owners cannot be removed from the app
  addedBy?: string;
  addedAt?: string;
}

// The built-in owners live in code, the rest in Firestore. The panel shows
// both together so an admin sees the real list, not half of it.
export function subscribeToAdmins(callback: (admins: AdminEntry[]) => void): () => void {
  return onSnapshot(collection(db, 'adminEmails'), (snap) => {
    const granted: AdminEntry[] = snap.docs.map((d) => ({
      email: d.id,
      builtIn: false,
      addedBy: (d.data() as any).addedBy,
      addedAt: (d.data() as any).addedAt,
    }));
    const builtIn: AdminEntry[] = BOOTSTRAP_ADMIN_EMAILS.map((email) => ({
      email,
      builtIn: true,
    }));
    const seen = new Set(builtIn.map((a) => a.email));
    callback([...builtIn, ...granted.filter((a) => !seen.has(a.email))]);
  });
}

export async function addAdmin(email: string): Promise<void> {
  const call = httpsCallable<{ email: string }, { ok: boolean }>(functions, 'addAdmin');
  await call({ email });
}

export async function removeAdmin(email: string): Promise<void> {
  const call = httpsCallable<{ email: string }, { ok: boolean }>(functions, 'removeAdmin');
  await call({ email });
}
