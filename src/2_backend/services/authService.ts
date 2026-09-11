import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider } from "./firebaseConfig";

// Staff only. Clients never hold a Google account -- they enter with their
// room number, phone and password, and their role is decided by the staff
// directory (see useSession) rather than anything the browser asserts.
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (e) {
    console.error("Google sign-in failed", e);
    return null;
  }
}

export function signOutUser(): Promise<void> {
  return signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
