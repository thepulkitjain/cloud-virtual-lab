import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';

// Public Pages
import LandingPage from './pages/public/LandingPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import NotFoundPage from './pages/public/NotFoundPage';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import ProfileSettingsPage from './pages/student/ProfileSettingsPage';
import LabsListPage from './pages/student/LabsListPage';
import LabWorkspacePage from './pages/student/LabWorkspacePage';
import LabHistoryPage from './pages/student/LabHistoryPage';
import SecureStoragePage from './pages/student/SecureStoragePage';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagementPage from './pages/admin/UserManagementPage';
import LabGovernancePage from './pages/admin/LabGovernancePage';
import StorageMonitoringPage from './pages/admin/StorageMonitoringPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
