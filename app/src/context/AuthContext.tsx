import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '../api/client';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { storage } from '../lib/storage';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore a saved session on launch.
  useEffect(() => {
    (async () => {
      const savedToken = await storage.getToken();
      const savedUser = await storage.getUser<User>();
      if (savedToken && savedUser) {
        setAuthToken(savedToken);
        setToken(savedToken);
        setUser(savedUser);
        connectSocket(savedToken);
      }
      setLoading(false);
    })();
  }, []);

  const applySession = async (t: string, u: User) => {
    setAuthToken(t);
    setToken(t);
    setUser(u);
    await storage.setToken(t);
    await storage.setUser(u);
    connectSocket(t);
  };

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    await applySession(res.token, res.user);
  };

  const register = async (username: string, password: string, displayName?: string) => {
    const res = await api.register(username, password, displayName);
    await applySession(res.token, res.user);
  };

  const logout = async () => {
    disconnectSocket();
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await storage.clear();
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
