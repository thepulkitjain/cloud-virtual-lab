import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Users,
  HardDrive,
  FileText,
  Search,
  Sliders,
  Trash2,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AdminStorageOverview } from '../../types/admin.types';
import {
  AdminStorageUsersResponse,
  AdminStorageFilesResponse,
  StoredFile,
} from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import { useToast } from '../../contexts/ToastContext';

export const StorageMonitoringPage: React.FC = () => {
  // Tabs: 'users' | 'files'
  const [activeTab, setActiveTab] = useState<'users' | 'files'>('users');

  // Overview Data
  const [overview, setOverview] = useState<AdminStorageOverview | null>(null);

  // Users Data
  const [userData, setUserData] = useState<AdminStorageUsersResponse | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);

  // Files Data
  const [filesData, setFilesData] = useState<AdminStorageFilesResponse | null>(null);
  const [filesSearch, setFilesSearch] = useState('');
  const [filesPage, setFilesPage] = useState(1);

  // Modals & Actions
  const [quotaModalUser, setQuotaModalUser] = useState<{
    userId: string;
    email: string;
    name: string;
    currentQuotaMb: number;
  } | null>(null);
  const [newQuotaMb, setNewQuotaMb] = useState<number>(100);
  const [isUpdatingQuota, setIsUpdatingQuota] = useState(false);

  const [deleteFileItem, setDeleteFileItem] = useState<StoredFile | null>(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { success, error } = useToast();

  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 B';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  // 1. Fetch Overview
  const fetchOverview = useCallback(async () => {
    try {
      const data = await StorageService.getAdminOverview();
      setOverview(data);
    } catch (err: any) {
      console.error('Failed to load storage overview:', err);
    }
  }, []);

  // 2. Fetch Users Storage
  const fetchUsers = useCallback(async () => {
    try {
      const data = await StorageService.getAdminUsers({
        search: userSearch.trim() || undefined,
        page: userPage,
        limit: 10,
      });
      setUserData(data);
    } catch (err: any) {
      console.error('Failed to load user storage:', err);
    }
  }, [userSearch, userPage]);

  // 3. Fetch All Files
  const fetchFiles = useCallback(async () => {
    try {
      const data = await StorageService.getAdminFiles({
        search: filesSearch.trim() || undefined,
        page: filesPage,
        limit: 10,
      });
      setFilesData(data);
    } catch (err: any) {
      console.error('Failed to load system files:', err);
    }
  }, [filesSearch, filesPage]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await Promise.all([fetchOverview(), fetchUsers(), fetchFiles()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load storage governance records.');
      error(err.message || 'Error loading records.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchOverview, fetchUsers, fetchFiles, error]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Handle Quota Adjustment
  const handleOpenQuotaModal = (user: {
    userId: string;
    email: string;
    name: string;
    quotaBytes: string;
  }) => {
    const quotaMb = Math.round(parseInt(user.quotaBytes, 10) / (1024 * 1024));
    setQuotaModalUser({
      userId: user.userId,
      email: user.email,
      name: user.name,
      currentQuotaMb: quotaMb,
    });
    setNewQuotaMb(quotaMb);
  };

  const handleSaveQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModalUser) return;

    setIsUpdatingQuota(true);
    try {
      await StorageService.updateUserQuota(quotaModalUser.userId, Number(newQuotaMb));
      success(`Updated quota for ${quotaModalUser.name} to ${newQuotaMb} MB`, 'Quota Updated');
      setQuotaModalUser(null);
      fetchOverview();
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to update quota.');
    } finally {
      setIsUpdatingQuota(false);
    }
  };

  // Handle Admin File Deletion
  const executeDeleteFile = async () => {
    if (!deleteFileItem) return;

    setIsDeletingFile(true);
    try {
      await StorageService.adminDeleteFile(deleteFileItem.id);
      success(`File "${deleteFileItem.originalName}" permanently deleted.`, 'File Removed');
      setDeleteFileItem(null);
      fetchOverview();
      fetchFiles();
      fetchUsers();
    } catch (err: any) {
      error(err.message || 'Failed to delete file.');
    } finally {
      setIsDeletingFile(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-medium mb-2">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
            Administrative Storage Governance
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Storage Subsystem Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Global monitoring of encrypted disk capacity, student storage allocations, and file records.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* Global Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Allocated Quota</p>
            <p className="text-lg font-bold font-mono text-white">
              {formatBytes(overview?.totalAllocatedQuotaBytes)}
            </p>
            <span className="text-[10px] text-purple-300 font-mono">Total System Quotas</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Used Cipher Disk</p>
            <p className="text-lg font-bold font-mono text-cyan-300">
              {formatBytes(overview?.totalUsedBytes)}
            </p>
            <span className="text-[10px] text-cyan-400 font-mono">AES-256 Encrypted</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Stored Files</p>
            <p className="text-lg font-bold font-mono text-white">
              {overview?.totalFiles || 0}
            </p>
            <span className="text-[10px] text-emerald-400 font-mono">Unique SHA-256 Objects</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Sliders className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Utilization Rate</p>
            <p className="text-lg font-bold font-mono text-white">
              {overview?.systemUtilizationPercentage || 0}%
            </p>
            <span className="text-[10px] text-slate-400 font-mono">Of Allocated Limits</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'users'
              ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          User Quotas &amp; Allocations
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'files'
              ? 'bg-purple-600/20 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          Global Files Directory
        </button>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TAB 1: USERS STORAGE */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* User Search Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative sm:w-72">
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                placeholder="Search user name or email..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Total Users: {userData?.pagination.total || 0}
            </span>
          </div>

          {/* Users Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Used Storage</th>
                    <th className="px-5 py-3.5">Assigned Quota</th>
                    <th className="px-5 py-3.5">Usage %</th>
                    <th className="px-5 py-3.5">File Count</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {userData?.users.map((u) => (
                    <tr key={u.userId} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{u.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded-full ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-cyan-300">
                        {formatBytes(u.usedBytes)}
                      </td>
                      <td className="px-5 py-4 font-mono text-white">
                        {formatBytes(u.quotaBytes)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] w-8">
                            {u.percentageUsed}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                u.percentageUsed >= 90
                                  ? 'bg-rose-500'
                                  : u.percentageUsed >= 70
                                  ? 'bg-amber-500'
                                  : 'bg-cyan-400'
                              }`}
                              style={{ width: `${Math.max(u.percentageUsed, 4)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono">{u.fileCount}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenQuotaModal(u)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/40 text-purple-300 text-xs font-medium transition cursor-pointer"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Adjust Quota
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {userData && userData.pagination.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Page {userData.pagination.page} of {userData.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={userPage <= 1}
                    onClick={() => setUserPage((p) => p - 1)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={userPage >= userData.pagination.totalPages}
                    onClick={() => setUserPage((p) => p + 1)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: GLOBAL FILES DIRECTORY */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* File Search Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="relative sm:w-72">
              <input
                type="text"
                value={filesSearch}
                onChange={(e) => {
                  setFilesSearch(e.target.value);
                  setFilesPage(1);
                }}
                placeholder="Search by file name..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
            </div>

            <span className="text-[11px] text-slate-500 font-mono">
              Total Encrypted Files: {filesData?.pagination.total || 0}
            </span>
          </div>

          {/* Files Table */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">Original File Name</th>
                    <th className="px-5 py-3.5">Owner</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5">Size</th>
                    <th className="px-5 py-3.5">Uploaded</th>
                    <th className="px-5 py-3.5 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-slate-300">
                  {filesData?.files.map((file) => (
                    <tr key={file.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white truncate max-w-xs" title={file.originalName}>
                          {file.originalName}
                        </p>
                        <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Lock className="w-2.5 h-2.5 text-cyan-400" />
                          AES-256-GCM
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-white text-xs">
                          {file.user ? `${file.user.firstName} ${file.user.lastName}` : 'Student'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {file.user?.email || '—'}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                          {file.fileCategory}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-cyan-300">
                        {formatBytes(file.sizeBytes)}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-400 text-[11px]">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteFileItem(file)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 text-xs font-medium transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Purge File
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Files Pagination */}
            {filesData && filesData.pagination.totalPages > 1 && (
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
                <span>
                  Page {filesData.pagination.page} of {filesData.pagination.totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={filesPage <= 1}
                    onClick={() => setFilesPage((p) => p - 1)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={filesPage >= filesData.pagination.totalPages}
                    onClick={() => setFilesPage((p) => p + 1)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-40 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quota Adjustment Modal */}
      {quotaModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Adjust Storage Quota</h3>
              </div>
              <button
                type="button"
                onClick={() => setQuotaModalUser(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuota} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <p className="text-white font-semibold">{quotaModalUser.name}</p>
                <p className="text-[11px] text-slate-400 font-mono">{quotaModalUser.email}</p>
                <p className="text-[11px] text-purple-300 font-mono mt-1">
                  Current Limit: {quotaModalUser.currentQuotaMb} MB
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">
                  New Quota Allocation (in Megabytes)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={10240}
                  value={newQuotaMb}
                  onChange={(e) => setNewQuotaMb(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition font-mono"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex gap-2 pt-1">
                {[50, 100, 250, 500, 1024].map((mb) => (
                  <button
                    key={mb}
                    type="button"
                    onClick={() => setNewQuotaMb(mb)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition ${
                      newQuotaMb === mb
                        ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {mb} MB
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setQuotaModalUser(null)}
                  disabled={isUpdatingQuota}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingQuota || newQuotaMb <= 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow transition disabled:opacity-50"
                >
                  {isUpdatingQuota ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Apply New Quota'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete File Confirmation */}
      {deleteFileItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">Administrative File Purge</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Permanently purge file{' '}
                <span className="font-semibold text-slate-200">
                  "{deleteFileItem.originalName}"
                </span>{' '}
                belonging to{' '}
                <span className="font-semibold text-slate-200">
                  {deleteFileItem.user?.email || 'Student'}
                </span>
                ? Ciphertext and database records will be erased.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteFileItem(null)}
                disabled={isDeletingFile}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDeleteFile}
                disabled={isDeletingFile}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow transition disabled:opacity-50"
              >
                {isDeletingFile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Purging...
                  </>
                ) : (
                  'Confirm Purge'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageMonitoringPage;
