import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { users } from '../api/users';
import { clearToken, getToken, setToken } from '../api/client';
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
  const [loading, setLoading] = useState<boolean>(!!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    try {
      const u = await users.current();
      setUser(u);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const signin = useCallback(async (username: string, password: string) => {
    const u = await users.signin({ username, password });
    if (u.token) setToken(u.token);
    setUser(u);
  }, []);

  const signup = useCallback(async (body: Parameters<typeof users.signup>[0]) => {
    return await users.signup(body);
  }, []);

  const signout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(() => ({ user, loading, signin, signup, signout, refresh }), [user, loading, signin, signup, signout, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
