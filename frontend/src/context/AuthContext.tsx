/**
 * NAQAL GO - Auth context
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { fetchMe, loadToken, logout as apiLogout, setToken } from '@/src/api/client';

export type User = {
  id: string;
  phone: string;
  name: string;
  user_type: 'customer' | 'driver' | 'admin';
  profile_image?: string | null;
  rating?: number;
  total_orders?: number;
};

type AuthCtx = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const token = await loadToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await fetchMe();
      setUser(me as User);
    } catch (e) {
      console.warn('auth refresh failed', e);
      await setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        setUser,
        refresh,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
