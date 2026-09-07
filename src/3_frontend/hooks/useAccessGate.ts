import { useState, useEffect, useCallback } from 'react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../2_backend/services/firebaseConfig';

export type AccessRole = 'tenant' | 'admin' | null;

interface StoredAccess {
  role: AccessRole;
  roomId?: string;
  roomNumber?: string;
  tenantName?: string;
}

const STORAGE_KEY = 'voltra_access';

function readStored(): StoredAccess {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { role: null };
  } catch {
    return { role: null };
  }
}

function writeStored(data: StoredAccess) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export interface ClaimRoomInput {
  roomNumber: string;
  tenantName: string;
  tenantPhone?: string;
  hasElectricity: boolean;
}

export interface ClaimRoomResult {
  ok: boolean;
  roomId: string;
  reason?: 'taken_by_other';
}

// Tenants never log in with email/password. Every browser gets a Firebase
// anonymous uid; claiming a room stamps that uid onto the room doc as
// tenantUid, and Firestore rules key all tenant-scoped reads/writes off
// request.auth.uid == room.tenantUid. localStorage only caches the
// roomId/name for instant UI on reload -- it grants no access by itself.
export function useAccessGate() {
  const [user, setUser] = useState<User | null>(null);
  const [access, setAccess] = useState<StoredAccess>(readStored());
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          console.error('Anonymous sign-in failed', e);
        }
        return;
      }
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const enterRoom = useCallback(
    async (input: ClaimRoomInput): Promise<ClaimRoomResult> => {
      const claimRoomFn = httpsCallable(functions, 'claimRoom');
      const res = await claimRoomFn(input);
      const data = res.data as ClaimRoomResult;
      if (data.ok) {
        const next: StoredAccess = {
          role: 'tenant',
          roomId: data.roomId,
          roomNumber: input.roomNumber,
          tenantName: input.tenantName,
        };
        writeStored(next);
        setAccess(next);
      }
      return data;
    },
    []
  );

  const setAdminAccess = useCallback(() => {
    const next: StoredAccess = { role: 'admin' };
    writeStored(next);
    setAccess(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAccess({ role: null });
  }, []);

  return {
    authReady,
    uid: user?.uid ?? null,
    role: access.role,
    roomId: access.roomId ?? null,
    roomNumber: access.roomNumber ?? null,
    tenantName: access.tenantName ?? null,
    enterRoom,
    setAdminAccess,
    logout,
  };
}
