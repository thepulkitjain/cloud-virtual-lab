import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoadingScreen from './components/common/LoadingScreen';

// Lazy-loaded Public Pages
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const NotFoundPage = lazy(() => import('./pages/public/NotFoundPage'));

// Lazy-loaded Student Pages
const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const ProfileSettingsPage = lazy(() => import('./pages/student/ProfileSettingsPage'));
const LabsListPage = lazy(() => import('./pages/student/LabsListPage'));
const LabWorkspacePage = lazy(() => import('./pages/student/LabWorkspacePage'));
const LabHistoryPage = lazy(() => import('./pages/student/LabHistoryPage'));
const SecureStoragePage = lazy(() => import('./pages/student/SecureStoragePage'));

// Lazy-loaded Admin Pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const LabGovernancePage = lazy(() => import('./pages/admin/LabGovernancePage'));
const StorageMonitoringPage = lazy(() => import('./pages/admin/StorageMonitoringPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen message="Loading page component..." />}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Authenticated Student Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<StudentDashboard />} />
                <Route path="/profile" element={<ProfileSettingsPage />} />
                <Route path="/labs" element={<LabsListPage />} />
                <Route path="/labs/history" element={<LabHistoryPage />} />
                <Route path="/labs/:idOrSlug" element={<LabWorkspacePage />} />
                <Route path="/storage" element={<SecureStoragePage />} />
              </Route>

              {/* Authenticated Admin Routes (RBAC: ADMIN role only) */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN']}>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="labs" element={<LabGovernancePage />} />
                <Route path="storage" element={<StorageMonitoringPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
              </Route>

              {/* Fallback 404 Route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
