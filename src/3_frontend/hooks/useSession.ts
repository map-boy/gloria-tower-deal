import { useCallback, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../2_backend/services/firebaseConfig';
import { StaffRole } from '../../1_core/domain/types';

const BOOTSTRAP_ADMIN_EMAILS = [
  'techubwenge@gmail.com',
  'uwimbabazigloria05@gmail.com',
  'abdullazackniyigaba@gmail.com',
];

const STORAGE_KEY = 'gt_client_session';

interface ClientSession {
  roomId: string;
  roomNumber: string;
}

function readStored(): ClientSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Staff sign in with Google and their role comes from the staff directory.
// Clients never get a Google account -- they hold an anonymous uid, and the
// room they claimed is remembered locally only so the UI can skip straight
// back to their portal. It grants nothing on its own; the rules key off the
// uid stamped on the room.
export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [client, setClient] = useState<ClientSession | null>(readStored());

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error('Anonymous sign-in failed', e);
          setReady(true);
        }
        return;
      }
      setUser(u);

      if (u.isAnonymous || !u.email) {
        setStaffRole(null);
        setReady(true);
        return;
      }

      const email = u.email.toLowerCase();
      if (BOOTSTRAP_ADMIN_EMAILS.includes(email)) {
        setStaffRole('admin');
        setReady(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'staff', email));
        setStaffRole(snap.exists() ? ((snap.data().role as StaffRole) ?? null) : null);
      } catch {
        setStaffRole(null);
      }
      setReady(true);
    });
  }, []);

  const startClientSession = useCallback((session: ClientSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setClient(session);
  }, []);

  const clearClientSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setClient(null);
  }, []);

  return {
    ready,
    user,
    uid: user?.uid ?? null,
    email: user?.email ?? '',
    staffRole,
    client,
    startClientSession,
    clearClientSession,
  };
}
