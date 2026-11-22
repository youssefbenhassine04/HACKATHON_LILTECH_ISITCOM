import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getCurrentUser, setCurrentUser as storeSetCurrentUser, authenticate, logout as storeLogout, subscribeToStore } from '../lib/store';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, pass: string) => User | null;
  logout: () => void;
  hasRole: (roles: ('agent' | 'chef' | 'admin')[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getCurrentUser());

  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      setUser(getCurrentUser());
    });
    return unsubscribe;
  }, []);

  const login = (username: string, pass: string): User | null => {
    const authenticatedUser = authenticate(username, pass);
    if (authenticatedUser) {
      setUser(authenticatedUser);
      return authenticatedUser;
    }
    return null;
  };

  const handleLogout = () => {
    storeLogout();
    setUser(null);
  };

  const hasRole = (roles: ('agent' | 'chef' | 'admin')[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
