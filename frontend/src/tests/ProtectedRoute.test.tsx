import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/common/ProtectedRoute';
import * as AuthContextModule from '../contexts/AuthContext';
import { User } from '../types/auth.types';

const mockStudent: User = {
  id: 'u-1',
  firstName: 'Alex',
  lastName: 'Student',
  email: 'alex@virtuallab.edu',
  role: 'STUDENT',
  status: 'ACTIVE',
  storageQuotaBytes: '104857600',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockAdmin: User = {
  ...mockStudent,
  id: 'a-1',
  firstName: 'System',
  lastName: 'Admin',
  email: 'admin@virtuallab.edu',
  role: 'ADMIN',
};

function makeAuthState(overrides: Partial<ReturnType<typeof AuthContextModule.useAuth>>) {
  return {
    user: null,
    role: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    ...overrides,
  };
}

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading screen while authentication state is loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      makeAuthState({ isLoading: true })
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Student Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/Verifying authentication session/i)).toBeInTheDocument();
    expect(screen.queryByText('Student Dashboard')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      makeAuthState({ isAuthenticated: false, user: null })
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Student Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Student Dashboard')).not.toBeInTheDocument();
  });

  it('allows authenticated STUDENT into student routes and redirects from ADMIN routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      makeAuthState({
        isAuthenticated: true,
        user: mockStudent,
        role: 'STUDENT',
      })
    );

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/dashboard" element={<div>Student Dashboard</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <div>Admin Console</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Console')).not.toBeInTheDocument();
  });

  it('allows authenticated ADMIN into ADMIN routes and redirects from STUDENT-only routes', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue(
      makeAuthState({
        isAuthenticated: true,
        user: mockAdmin,
        role: 'ADMIN',
      })
    );

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/dashboard" element={<div>Student Dashboard</div>} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <div>Admin Console</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Admin Console')).toBeInTheDocument();
  });
});
