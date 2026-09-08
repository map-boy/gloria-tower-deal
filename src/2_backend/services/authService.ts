import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "./firebaseConfig";

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

// Built-in owners. Must match the lists in firestore.rules, storage.rules and
// functions/index.js -- they cannot be removed from inside the app.
export const BOOTSTRAP_ADMIN_EMAILS = [
  'techubwenge@gmail.com',
  'uwimbabazigloria05@gmail.com',
  'abdullazackniyigaba@gmail.com',
];

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const email = user.email ? user.email.toLowerCase() : '';
  if (email && BOOTSTRAP_ADMIN_EMAILS.includes(email)) return true;
  // Access granted by email, so it applies the first time they sign in.
  if (email && (await getDoc(doc(db, 'adminEmails', email))).exists()) return true;
  const snap = await getDoc(doc(db, "admins", user.uid));
  return snap.exists();
}
