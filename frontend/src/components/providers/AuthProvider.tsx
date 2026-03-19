'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  User,
  saveTokens,
  saveUser,
  clearTokens,
  getUser,
  getAccessToken,
  getRefreshToken,
  isAuthenticated as checkIsAuthenticated,
  getUserRole,
} from '@/lib/auth';

interface LoginResponse {
  data: {
    access_token: string;
    refresh_token: string;
    user: User;
  };
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string | null;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();

  const refreshAuth = useCallback(() => {
    const token = getAccessToken();
    const userData = getUser();
    const userRole = getUserRole();
    const authenticated = checkIsAuthenticated();

    setUser(userData);
    setIsAuthenticated(authenticated);
    setRole(userRole);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshAuth();
    
    // Listen for auth state changes from other components/tabs
    const handleAuthChange = () => {
      refreshAuth();
    };
    
    window.addEventListener('auth-state-change', handleAuthChange);
    return () => window.removeEventListener('auth-state-change', handleAuthChange);
  }, [refreshAuth]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', { email, password });
      const { access_token, refresh_token, user } = response.data.data;
      
      saveTokens(access_token, refresh_token);
      saveUser(user);
      
      setUser(user);
      setIsAuthenticated(true);
      setRole(user.role);
      
      return { success: true };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/auth/register', { username, email, password });
      return { success: true };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      return { success: false, error: err.response?.data?.error || 'Registration failed' };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearTokens();
      setUser(null);
      setIsAuthenticated(false);
      setRole(null);
      router.push('/login');
    }
  };

  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        role,
        isAdmin,
        login,
        register,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
