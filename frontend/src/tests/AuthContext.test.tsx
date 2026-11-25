import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/common/ProtectedRoute';
import AuthService from '../services/auth.service';
import { SESSION_EXPIRED_EVENT } from '../services/api';
import { User } from '../types/auth.types';

const mockUser: User = {
  id: 'student-1',
  firstName: 'Alex',
  lastName: 'Chen',
  email: 'alex@virtuallab.edu',
  role: 'STUDENT',
  status: 'ACTIVE',
  storageQuotaBytes: '104857600',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const AuthHarness: React.FC = () => {
  const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  return (
    <div>
      <div data-testid="auth-loading">{String(isLoading)}</div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'anonymous'}</div>
      <div data-testid="auth-email">{user?.email || 'none'}</div>
      {errorMsg && <div data-testid="auth-error">{errorMsg}</div>}

      <button
        type="button"
        onClick={async () => {
          setErrorMsg(null);
          try {
            await login({ email: 'alex@virtuallab.edu', password: 'Password123!' });
          } catch (err: any) {
            setErrorMsg(err.message);
          }
        }}
      >
        Trigger Login
      </button>

      <button
        type="button"
        onClick={async () => {
          setErrorMsg(null);
          try {
            await register({
              firstName: 'Alex',
              lastName: 'Chen',
              email: 'alex@virtuallab.edu',
              password: 'Password123!',
            });
          } catch (err: any) {
            setErrorMsg(err.message);
          }
        }}
      >
        Trigger Register
      </button>

      <button type="button" onClick={() => logout()}>
        Trigger Logout
      </button>
    </div>
  );
};

describe('AuthContext & Session Expiry Flows', () => {
  let setItemSpy: ReturnType<typeof vi.spyOn<Storage, 'setItem'>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
  });

  it('bootstraps authenticated user via /auth/me without storing tokens in web storage', async () => {
    vi.spyOn(AuthService, 'getMe').mockResolvedValue({ user: mockUser });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('auth-email')).toHaveTextContent('alex@virtuallab.edu');
    });

    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('handles initial /auth/me 401 cleanly without throwing or triggering expiry loop', async () => {
    vi.spyOn(AuthService, 'getMe').mockRejectedValue(
      Object.assign(new Error('Unauthorized'), { statusCode: 401 })
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <>
                  <div>Login Screen</div>
                  <AuthHarness />
                </>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-loading')).toHaveTextContent('false');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
      expect(screen.getByText('Login Screen')).toBeInTheDocument();
    });
  });

  it('supports login success, login failure, registration, and logout', async () => {
    vi.spyOn(AuthService, 'getMe').mockRejectedValue(new Error('Not logged in'));
    const loginSpy = vi
      .spyOn(AuthService, 'login')
      .mockRejectedValueOnce(new Error('Invalid email or password'))
      .mockResolvedValueOnce({ user: mockUser, token: 'cookie-only' });
    const registerSpy = vi
      .spyOn(AuthService, 'register')
      .mockResolvedValue({ user: mockUser, token: 'cookie-only' });
    const logoutSpy = vi.spyOn(AuthService, 'logout').mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('false'));

    // 1. Login failure
    fireEvent.click(screen.getByText('Trigger Login'));
    await waitFor(() => {
      expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid email or password');
      expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
    });

    // 2. Login success
    fireEvent.click(screen.getByText('Trigger Login'));
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
    expect(setItemSpy).not.toHaveBeenCalled();

    // 3. Logout
    fireEvent.click(screen.getByText('Trigger Logout'));
    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('anonymous');
    });

    // 4. Registration success
    fireEvent.click(screen.getByText('Trigger Register'));
    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });
  });

  it('clears session and redirects protected routes to /login when SESSION_EXPIRED_EVENT fires', async () => {
    vi.spyOn(AuthService, 'getMe').mockResolvedValue({ user: mockUser });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login Redirect Target</div>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <div>Protected Dashboard Content</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Protected Dashboard Content')).toBeInTheDocument();
    });

    // Simulate a mid-session 401 expired/revoked JWT event
    act(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    });

    await waitFor(() => {
      expect(screen.getByText('Login Redirect Target')).toBeInTheDocument();
      expect(screen.queryByText('Protected Dashboard Content')).not.toBeInTheDocument();
    });
  });
});
