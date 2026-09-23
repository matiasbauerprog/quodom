import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { users } from '../api/users';
import { forgetLegacyToken } from '../api/client';
import type { User } from '../api/types';

type AuthState = {
  user: User | null;
  loading: boolean;
  signin: (username: string, password: string) => Promise<void>;
  signup: (body: Parameters<typeof users.signup>[0]) => Promise<{ res: boolean; message: string; id?: string }>;
  signout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // The session cookie is invisible to scripts, so there is no way to know
  // beforehand whether someone is signed in: ask the server every time.
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    forgetLegacyToken();
    try {
      const u = await users.current();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signin = useCallback(async (username: string, password: string) => {
    const u = await users.signin({ username, password });
    setUser(u);
  }, []);

  const signup = useCallback(async (body: Parameters<typeof users.signup>[0]) => {
    return await users.signup(body);
  }, []);

  // Only the server can delete an httpOnly cookie. The screen logs out right
  // away either way; if the request fails the cookie outlives it, and the next
  // load finds the session still open.
  const signout = useCallback(() => {
    setUser(null);
    users.signout().catch(() => {});
  }, []);

  const value = useMemo<AuthState>(() => ({ user, loading, signin, signup, signout, refresh }), [user, loading, signin, signup, signout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
