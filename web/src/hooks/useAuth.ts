import * as React from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  loading: boolean;
}

/** Track the Firebase Auth session and expose Google sign-in / sign-out. */
export function useAuth() {
  const [state, setState] = React.useState<AuthState>({ user: null, loading: true });

  React.useEffect(() => {
    return onAuthStateChanged(auth, (user) => setState({ user, loading: false }));
  }, []);

  const signIn = React.useCallback(() => signInWithPopup(auth, googleProvider), []);
  const logOut = React.useCallback(() => signOut(auth), []);

  return { ...state, signIn, logOut };
}
