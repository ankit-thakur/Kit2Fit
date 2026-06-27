import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getCurrentSession, signIn, signOut as cognitoSignOut } from './cognito';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  idToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [idToken, setIdToken] = useState<string | null>(null);

  useEffect(() => {
    getCurrentSession()
      .then((session) => setIdToken(session?.isValid() ? session.getIdToken().getJwtToken() : null))
      .catch(() => setIdToken(null))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSignIn(email: string, password: string) {
    const session = await signIn(email, password);
    setIdToken(session.getIdToken().getJwtToken());
  }

  function handleSignOut() {
    cognitoSignOut();
    setIdToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        isAuthenticated: idToken !== null,
        idToken,
        signIn: handleSignIn,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
