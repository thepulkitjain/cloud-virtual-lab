import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  Shield,
  Clock,
  Eye,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  HardDrive,
  FlaskConical,
  Activity,
  Mail,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import AdminService from '../../services/admin.service';
import {
  AdminUserListItem,
  AdminUserDetails,
} from '../../types/admin.types';
import { Role, UserStatus } from '../../types/auth.types';

export const UserManagementPage: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const { success, error } = useToast();

  // Filters & State
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ALL' | Role>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | UserStatus>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // User Details Modal
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [inspectedUserDetails, setInspectedUserDetails] = useState<AdminUserDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Status Change Modal
  const [statusModalUser, setStatusModalUser] = useState<AdminUserListItem | null>(null);
  const [newStatus, setNewStatus] = useState<UserStatus>('ACTIVE');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Role Change Modal
  const [roleModalUser, setRoleModalUser] = useState<AdminUserListItem | null>(null);
  const [newRole, setNewRole] = useState<Role>('STUDENT');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Helpers
  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 B';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Fetch Users
  const fetchUsers = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const response = await AdminService.listUsers({
          search: search.trim() || undefined,
          role: selectedRole === 'ALL' ? undefined : selectedRole,
          status: selectedStatus === 'ALL' ? undefined : selectedStatus,
          page: currentPage,
          limit: 10,
        });

        setUsers(response.users);
        setTotalPages(response.pagination.totalPages || 1);
        setTotalUsers(response.pagination.totalUsers || 0);
      } catch (err: any) {
        console.error('Failed to list users:', err);
        error(err.response?.data?.message || 'Failed to retrieve registered users.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [search, selectedRole, selectedStatus, currentPage, error]
  );

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Load User Details
  const handleInspectUser = async (userId: string) => {
    setInspectedUserId(userId);
    setIsLoadingDetails(true);
    try {
      const details = await AdminService.getUser(userId);
      setInspectedUserDetails(details);
    } catch (err: any) {
      console.error('Failed to fetch user details:', err);
      error(err.response?.data?.message || 'Unable to load detailed user profile.');
      setInspectedUserId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Submit Status Change
  const handleUpdateStatus = async () => {
    if (!statusModalUser) return;
    setIsUpdatingStatus(true);
    try {
      await AdminService.updateUserStatus(statusModalUser.id, newStatus);
      success(`Updated account status for ${statusModalUser.name} to ${newStatus}.`);
      setStatusModalUser(null);
      fetchUsers(true);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      error(err.response?.data?.message || 'Failed to update account status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Submit Role Change
  const handleUpdateRole = async () => {
    if (!roleModalUser) return;
    setIsUpdatingRole(true);
    try {
      await AdminService.updateUserRole(roleModalUser.id, newRole);
      success(`Updated role for ${roleModalUser.name} to ${newRole}.`);
      setRoleModalUser(null);
      fetchUsers(true);
    } catch (err: any) {
      console.error('Failed to update role:', err);
      error(err.response?.data?.message || 'Failed to update user role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const isProtectedRootAdmin = (email: string) => {
    return email === 'admin@virtuallab.edu';
  };

  const isSelf = (userId: string) => {
    return currentAdmin?.id === userId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-medium mb-2">
            <Users className="w-3.5 h-3.5 text-purple-400" />
            User Directory &amp; RBAC Governance
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Oversee registered accounts, audit permissions, adjust account states, and inspect storage quotas.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers(true)}
            disabled={isRefreshing || isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by full name, email, or student roll number..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 text-[11px]">Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Roles</option>
              <option value="STUDENT" className="bg-slate-900">Student</option>
              <option value="ADMIN" className="bg-slate-900">Admin</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400 text-[11px]">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900">All Statuses</option>
              <option value="ACTIVE" className="bg-slate-900">Active</option>
              <option value="INACTIVE" className="bg-slate-900">Inactive</option>
              <option value="SUSPENDED" className="bg-slate-900">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-400">Loading user directory...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-white">No users found</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting your search criteria or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Department / ID</th>
                  <th className="py-3 px-3">Storage Used</th>
                  <th className="py-3 px-3 text-center">Labs</th>
                  <th className="py-3 px-3">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {users.map((u) => {
                  const isCurrent = isSelf(u.id);
                  const isRoot = isProtectedRootAdmin(u.email);
                  const storagePercent = Math.min(100, Math.round(u.storagePercentageUsed || 0));

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 text-purple-300 font-bold flex items-center justify-center shrink-0 text-xs">
                            {u.firstName?.[0] || u.name?.[0] || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-white truncate">{u.name}</p>
                              {isCurrent && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                  YOU
                                </span>
                              )}
                              {isRoot && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  ROOT
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {u.role === 'ADMIN' ? (
                            <Shield className="w-2.5 h-2.5" />
                          ) : (
                            <GraduationCap className="w-2.5 h-2.5" />
                          )}
                          {u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : u.status === 'SUSPENDED'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-400'
                                : u.status === 'SUSPENDED'
                                ? 'bg-rose-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          {u.status}
                        </span>
                      </td>

                      {/* Department / Student ID */}
                      <td className="py-3 px-3 text-slate-400">
                        {u.department ? (
                          <div>
                            <p className="text-white text-[11px]">{u.department}</p>
                            <p className="text-[10px] font-mono">{u.studentId || 'No ID'}</p>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Storage */}
                      <td className="py-3 px-3">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{formatBytes(u.storageUsedBytes)}</span>
                            <span>{storagePercent}%</span>
                          </div>
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                storagePercent > 90
                                  ? 'bg-rose-500'
                                  : storagePercent > 70
                                  ? 'bg-amber-500'
                                  : 'bg-purple-500'
                              }`}
                              style={{ width: `${storagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Labs Completed */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-white text-[11px] px-2 py-0.5 rounded bg-slate-800">
                          {u.totalLabSessions || 0}
                        </span>
                      </td>

                      {/* Created At */}
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Inspect User */}
                          <button
                            onClick={() => handleInspectUser(u.id)}
                            title="Inspect User Details"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Change Status */}
                          <button
                            onClick={() => {
                              setStatusModalUser(u);
                              setNewStatus(u.status);
                            }}
                            disabled={isCurrent || isRoot}
                            title={
                              isCurrent
                                ? 'Cannot modify your own status'
                                : isRoot
                                ? 'Root administrator is protected'
                                : 'Update Account Status'
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Change Role */}
                          <button
                            onClick={() => {
                              setRoleModalUser(u);
                              setNewRole(u.role);
                            }}
                            disabled={isCurrent || isRoot}
                            title={
                              isCurrent
                                ? 'Cannot modify your own role'
                                : isRoot
                                ? 'Root administrator is protected'
                                : 'Update Account Role'
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <span className="font-semibold text-white">{users.length}</span> of{' '}
            <span className="font-semibold text-white">{totalUsers}</span> users
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-slate-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* -------------------- MODAL: User Details -------------------- */}
      {inspectedUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Account Details</h3>
                  <p className="text-xs text-slate-400">Comprehensive profile &amp; activity telemetry</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInspectedUserId(null);
                  setInspectedUserDetails(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {isLoadingDetails || !inspectedUserDetails ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                  <p className="text-slate-400">Loading user profile and records...</p>
                </div>
              ) : (
                <>
                  {/* Basic Profile Card */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500 text-purple-300 font-extrabold text-base flex items-center justify-center">
                        {inspectedUserDetails.user.firstName?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white">
                            {inspectedUserDetails.user.firstName} {inspectedUserDetails.user.lastName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                              inspectedUserDetails.user.role === 'ADMIN'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {inspectedUserDetails.user.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                              inspectedUserDetails.user.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {inspectedUserDetails.user.status}
                          </span>
                        </div>
                        <p className="text-slate-400 flex items-center gap-1.5 mt-1 text-[11px]">
                          <Mail className="w-3 h-3 text-slate-500" />
                          {inspectedUserDetails.user.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-slate-400 text-right space-y-1">
                      <p className="text-[11px]">
                        Joined: {formatDate(inspectedUserDetails.user.createdAt)}
                      </p>
                      <p className="text-[11px]">
                        Last Login: {formatDate(inspectedUserDetails.user.profile?.lastLoginAt)}
                      </p>
                    </div>
                  </div>

                  {/* Student Academic Details */}
                  {inspectedUserDetails.user.profile && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Department
                        </span>
                        <p className="font-semibold text-white mt-1">
                          {inspectedUserDetails.user.profile.department || 'Not Specified'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Student ID
                        </span>
                        <p className="font-mono font-semibold text-white mt-1">
                          {inspectedUserDetails.user.profile.studentId || '—'}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Semester
                        </span>
                        <p className="font-semibold text-white mt-1">
                          {inspectedUserDetails.user.profile.semester ? `Semester ${inspectedUserDetails.user.profile.semester}` : '—'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stats Grid: Storage & Lab Submissions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Storage Stats */}
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                        <HardDrive className="w-4 h-4" />
                        Storage Vault Status
                      </div>
                      <div className="space-y-1.5 text-slate-300 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Allocated Quota:</span>
                          <span className="font-mono font-bold text-white">
                            {formatBytes(inspectedUserDetails.storageStats.quotaBytes)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Used Storage:</span>
                          <span className="font-mono text-purple-300">
                            {formatBytes(inspectedUserDetails.storageStats.usedBytes)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Remaining Storage:</span>
                          <span className="font-mono text-emerald-400">
                            {formatBytes(inspectedUserDetails.storageStats.remainingBytes)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Total Encrypted Files:</span>
                          <span className="font-mono text-white">
                            {inspectedUserDetails.storageStats.totalFiles} files ({inspectedUserDetails.storageStats.totalFolders} folders)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Lab Stats */}
                    <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
                      <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                        <FlaskConical className="w-4 h-4" />
                        Virtual Lab Engagement
                      </div>
                      <div className="space-y-1.5 text-slate-300 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Lab Sessions Started:</span>
                          <span className="font-mono font-bold text-white">
                            {inspectedUserDetails.labStats.totalSessions}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Exercises Submitted:</span>
                          <span className="font-mono text-white">
                            {inspectedUserDetails.labStats.totalSubmissions}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Exercises Passed:</span>
                          <span className="font-mono text-emerald-400">
                            {inspectedUserDetails.labStats.passedSubmissions}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Submission Pass Rate:</span>
                          <span className="font-mono font-bold text-cyan-300">
                            {inspectedUserDetails.labStats.passRatePercentage}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Lab Sessions */}
                  <div>
                    <h5 className="font-semibold text-white mb-2 flex items-center gap-1.5 text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Recent Lab Sessions
                    </h5>
                    {inspectedUserDetails.labStats.recentSessions.length === 0 ? (
                      <p className="text-slate-500 text-[11px] py-3 italic">
                        No virtual laboratory sessions initiated yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {inspectedUserDetails.labStats.recentSessions.map((session) => (
                          <div
                            key={session.id}
                            className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <p className="font-semibold text-white">{session.lab.title}</p>
                              <span className="text-slate-400 text-[10px] font-mono">
                                {session.lab.category} • {session.lab.difficulty}
                              </span>
                            </div>
                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  session.status === 'COMPLETED'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : session.status === 'IN_PROGRESS'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {session.status} (Score: {session.score})
                              </span>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {formatDate(session.startedAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activities */}
                  <div>
                    <h5 className="font-semibold text-white mb-2 flex items-center gap-1.5 text-xs">
                      <Activity className="w-3.5 h-3.5 text-slate-400" />
                      Audit Trail for User
                    </h5>
                    {inspectedUserDetails.recentActivities.length === 0 ? (
                      <p className="text-slate-500 text-[11px] py-3 italic">
                        No recent platform activities logged.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {inspectedUserDetails.recentActivities.map((act) => (
                          <div
                            key={act.id}
                            className="p-2 rounded bg-slate-950/40 border border-slate-800/80 flex items-center justify-between text-[11px]"
                          >
                            <span className="font-mono text-purple-300">{act.action}</span>
                            <span className="text-slate-400 text-[10px]">{formatDate(act.createdAt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
              <button
                onClick={() => {
                  setInspectedUserId(null);
                  setInspectedUserDetails(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: Change Status -------------------- */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Sliders className="w-4 h-4 text-purple-400" />
                Update Account Status
              </div>
              <button
                onClick={() => setStatusModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              Modifying status for{' '}
              <span className="font-semibold text-white">{statusModalUser.name}</span> (
              {statusModalUser.email}).
            </p>

            <div className="space-y-2">
              <label className="text-slate-400 text-[11px]">Select Target Status:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="ACTIVE">ACTIVE (Full access permitted)</option>
                <option value="INACTIVE">INACTIVE (Account disabled)</option>
                <option value="SUSPENDED">SUSPENDED (Access blocked due to policy/security)</option>
              </select>
            </div>

            {newStatus === 'SUSPENDED' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  Suspending this account will immediately revoke all active JWT sessions and disallow further login attempts.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setStatusModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateStatus}
                disabled={isUpdatingStatus}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50"
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Apply Status'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL: Change Role -------------------- */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                Modify Role Assignment
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-slate-300">
              Update role assignment for{' '}
              <span className="font-semibold text-white">{roleModalUser.name}</span> (
              {roleModalUser.email}).
            </p>

            <div className="space-y-2">
              <label className="text-slate-400 text-[11px]">Select Role:</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
              >
                <option value="STUDENT">STUDENT (Standard laboratory &amp; storage user)</option>
                <option value="ADMIN">ADMIN (Full platform administrative privileges)</option>
              </select>
            </div>

            {newRole === 'ADMIN' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Granting ADMIN privileges gives this user complete authority to inspect all student files, modify quotas, and manage laboratories.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateRole}
                disabled={isUpdatingRole}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition disabled:opacity-50"
              >
                {isUpdatingRole ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm Role Change'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
