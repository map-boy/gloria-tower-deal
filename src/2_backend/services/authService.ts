import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { auth, googleProvider } from "./firebaseConfig";

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

export function verifyAdminPassword(password: string): boolean {
  return password === import.meta.env.VITE_ADMIN_PASSWORD;
}
