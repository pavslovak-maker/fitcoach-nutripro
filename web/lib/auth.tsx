'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  userId: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const uid = localStorage.getItem('user_id');
    if (token && uid) {
      setAuthenticated(true);
      setUserId(uid);
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setAuthenticated(true);
    setUserId(result.userId);
    router.push('/');
  }, [router]);

  const register = useCallback(async (payload: any) => {
    const result = await api.register(payload);
    setAuthenticated(true);
    setUserId(result.userId);
    router.push('/');
  }, [router]);

  const logout = useCallback(() => {
    api.clearTokens();
    setAuthenticated(false);
    setUserId(null);
    router.push('/auth');
  }, [router]);

  return (
    <AuthContext.Provider value={{ loading, authenticated, userId, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
