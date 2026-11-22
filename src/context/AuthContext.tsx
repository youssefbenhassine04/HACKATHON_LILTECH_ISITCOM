import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { apiGetMe, apiLogin, apiLogout } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<User>;
  logout: () => void;
  hasRole: (roles: ('agent' | 'chef' | 'admin')[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication is backed by the server: an httpOnly session cookie is set on
 * login and the current user is restored with GET /api/auth/me on reload.
 * Nothing sensitive is stored in localStorage/sessionStorage.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    apiGetMe()
      .then(({ user: current }) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        // 401 (no session) or the API being unreachable: fail closed.
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, pass: string): Promise<User> => {
    const { user: authenticated } = await apiLogin(username, pass);
    setUser(authenticated);
    return authenticated;
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    // Clears the server session; the UI does not wait for the round trip.
    void apiLogout().catch(() => undefined);
  }, []);

  const hasRole = useCallback(
    (roles: ('agent' | 'chef' | 'admin')[]): boolean => (user ? roles.includes(user.role) : false),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout: handleLogout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
