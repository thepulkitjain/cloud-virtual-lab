import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role, LoginPayload, RegisterPayload, UpdateProfilePayload, ChangePasswordPayload } from '../types/auth.types';
import AuthService from '../services/auth.service';
import { SESSION_EXPIRED_EVENT } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<User>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check existing session via HTTP-only cookie on application boot
  const refreshUser = useCallback(async () => {
    try {
      const data = await AuthService.getMe();
      setUser(data.user);
    } catch {
      // 401 or not logged in: clear state without throwing uncaught exceptions
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Proactively synchronize AuthContext when an authenticated session expires or is revoked (HTTP 401)
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser((prev) => (prev ? null : prev));
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    };
  }, []);

  const login = async (payload: LoginPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await AuthService.login(payload);
      setUser(loggedInUser);
      return loggedInUser;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const { user: registeredUser } = await AuthService.register(payload);
      setUser(registeredUser);
      return registeredUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await AuthService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setIsLoading(false);
    }
  };

  const updateProfile = async (payload: UpdateProfilePayload): Promise<User> => {
    const { user: updatedUser } = await AuthService.updateProfile(payload);
    setUser(updatedUser);
    return updatedUser;
  };

  const changePassword = async (payload: ChangePasswordPayload): Promise<void> => {
    await AuthService.changePassword(payload);
  };

  const role = user ? user.role : null;
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        updateProfile,
        changePassword,
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
