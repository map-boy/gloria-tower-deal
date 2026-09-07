import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

// Admin-side reset for a tenant who forgot their room password. The password
// itself is never stored anywhere the client can read -- the function hashes
// it into roomSecrets/{roomId}, which is closed to every client including the
// admin's own browser.
export async function setRoomPassword(roomId: string, password: string): Promise<void> {
  const call = httpsCallable<{ roomId: string; password: string }, { ok: boolean }>(
    functions,
    'setRoomPassword'
  );
  await call({ roomId, password });
}
