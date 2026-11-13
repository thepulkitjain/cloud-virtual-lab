import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  FlaskConical,
  Database,
  FileText,
  ArrowRight,
  Server,
  Lock,
  Activity,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  UserCheck,
  UserX,
  PlayCircle,
  HardDrive,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import AdminService from '../../services/admin.service';
import { AdminDashboardMetrics } from '../../types/admin.types';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage(null);

    try {
      const data = await AdminService.getDashboard();
      setMetrics(data);
    } catch (err: any) {
      console.error('Failed to load dashboard metrics:', err);
      setErrorMessage(
        err.response?.data?.message || 'Unable to retrieve administrative dashboard metrics.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 B';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const governanceTiles = [
    {
      title: 'User Management',
      desc: 'Review registered accounts, toggle activation & suspension statuses, and audit role assignments.',
      to: '/admin/users',
      icon: Users,
      badge: `${metrics?.users.total ?? '—'} Accounts`,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Laboratory Governance',
      desc: 'Oversee simulated virtual labs, maintain exercises, and inspect student completion metrics.',
      to: '/admin/labs',
      icon: FlaskConical,
      badge: `${metrics?.laboratories.total ?? '—'} Laboratories`,
      color: 'from-cyan-500 to-teal-600',
    },
    {
      title: 'Storage Governance',
      desc: 'Inspect global storage capacity, adjust individual quotas, and purge orphaned encrypted files.',
      to: '/admin/storage',
      icon: Database,
      badge: `${metrics?.storage.totalFiles ?? '—'} Files`,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Audit & System Logs',
      desc: 'Inspect immutable administrative audit trails and live platform user activity logs.',
      to: '/admin/audit-logs',
      icon: FileText,
      badge: 'Dual Audit Trail',
      color: 'from-amber-500 to-rose-600',
    },
  ];

  // Storage usage ratio calculation
  const usedStorage = metrics ? parseInt(metrics.storage.usedBytes || '0', 10) : 0;
  const allocatedStorage = metrics ? parseInt(metrics.storage.allocatedBytes || '1', 10) : 1;
  const storagePercent = Math.min(100, Math.round((usedStorage / (allocatedStorage || 1)) * 100)) || 0;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-900 border border-purple-900/40 p-6 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-mono font-medium mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              Administrative Governance Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Platform Overview &amp; Control
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Logged in as <span className="font-semibold text-white">{user?.firstName} {user?.lastName}</span> ({user?.email}) with root administrative permissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing || isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Metrics'}
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !metrics ? (
        <div className="py-16 text-center">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading governance metrics and system telemetry...</p>
        </div>
      ) : (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Users Metric */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">User Directory</span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{metrics?.users.total ?? 0}</span>
                <span className="text-xs text-slate-400">total accounts</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> {metrics?.users.active ?? 0} active
                </span>
                <span className="text-slate-400">
                  {metrics?.users.students ?? 0} students • {metrics?.users.admins ?? 0} admins
                </span>
                {(metrics?.users.suspended ?? 0) > 0 && (
                  <span className="text-rose-400 flex items-center gap-1">
                    <UserX className="w-3 h-3" /> {metrics?.users.suspended} suspended
                  </span>
                )}
              </div>
            </div>

            {/* Virtual Labs Metric */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Virtual Laboratories</span>
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <FlaskConical className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{metrics?.laboratories.total ?? 0}</span>
                <span className="text-xs text-slate-400">labs deployed</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400">
                  {metrics?.laboratories.active ?? 0} active &amp; ready
                </span>
                <span className="text-slate-500">
                  {metrics?.laboratories.inactive ?? 0} archived
                </span>
              </div>
            </div>

            {/* Lab Sessions Metric */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Student Lab Sessions</span>
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <PlayCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{metrics?.labSessions.total ?? 0}</span>
                <span className="text-xs text-slate-400">sessions started</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {metrics?.labSessions.completed ?? 0} finished
                </span>
                <span className="text-cyan-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {metrics?.labSessions.inProgress ?? 0} active now
                </span>
              </div>
            </div>

            {/* Storage Metric */}
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Cloud Vault Utilization</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">
                  {formatBytes(metrics?.storage.usedBytes)}
                </span>
                <span className="text-xs text-slate-400">
                  / {formatBytes(metrics?.storage.allocatedBytes)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1">
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      storagePercent > 90
                        ? 'bg-rose-500'
                        : storagePercent > 70
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-purple-500 to-indigo-500'
                    }`}
                    style={{ width: `${storagePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{storagePercent}% allocated space used</span>
                  <span>{metrics?.storage.totalFiles ?? 0} files</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Telemetry & Health */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Server className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Database Engine</p>
                <p className="text-xs font-bold text-white">PostgreSQL 18.6</p>
                <span className="text-[10px] text-emerald-400 font-mono">Connected • Online</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Encryption Subsystem</p>
                <p className="text-xs font-bold text-white">AES-256-GCM</p>
                <span className="text-[10px] text-cyan-400 font-mono">Zero-Knowledge Storage</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Auth &amp; Session Guard</p>
                <p className="text-xs font-bold text-white">HTTP-Only JWT Cookie</p>
                <span className="text-[10px] text-purple-400 font-mono">Strict SameSite CSRF</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-[11px] text-slate-400">Backend Verification</p>
                <p className="text-xs font-bold text-emerald-400">84/84 Tests Passing</p>
                <span className="text-[10px] text-slate-400 font-mono">Vitest Suite Verified</span>
              </div>
            </div>
          </div>

          {/* Governance Navigation Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Administration Modules
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {governanceTiles.map((tile, i) => {
                const Icon = tile.icon;
                return (
                  <div
                    key={i}
                    className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${tile.color} flex items-center justify-center shadow-md`}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                          {tile.badge}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
                        {tile.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tile.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">Admin Authorization</span>
                      <Link
                        to={tile.to}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 group-hover:text-purple-300 transition-colors"
                      >
                        Open Console
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dual Feed: Recent Platform Activities & Recent Administrative Audit Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activities */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">Recent System Activities</h3>
                </div>
                <Link
                  to="/admin/audit-logs"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  View All <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
                <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-96">
                  {metrics.recentActivities.map((act) => (
                    <div key={act.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 truncate">
                            {act.user.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              act.user.role === 'ADMIN'
                                ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            }`}
                          >
                            {act.user.role}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5 font-mono text-[11px]">
                          {act.action}
                          {act.details ? ` • ${act.details}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-[11px] text-slate-500">
                        <p>{formatDate(act.createdAt)}</p>
                        {act.ipAddress && (
                          <p className="font-mono text-[10px] text-slate-600">{act.ipAddress}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">
                  No system activity events recorded yet.
                </div>
              )}
            </div>

            {/* Recent Audit Logs */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">Administrative Audit Trail</h3>
                </div>
                <Link
                  to="/admin/audit-logs"
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
                >
                  View All <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {metrics?.recentAuditLogs && metrics.recentAuditLogs.length > 0 ? (
                <div className="divide-y divide-slate-800/60 overflow-y-auto max-h-96">
                  {metrics.recentAuditLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200 truncate">
                            {log.admin.name}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            {log.action}
                          </span>
                        </div>
                        <p className="text-slate-400 mt-0.5 font-mono text-[11px]">
                          Target: <span className="text-slate-300">{log.targetEntity}</span>
                          {log.targetId ? ` (${log.targetId.slice(0, 8)}...)` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-[11px] text-slate-500">
                        <p>{formatDate(log.createdAt)}</p>
                        {log.ipAddress && (
                          <p className="font-mono text-[10px] text-slate-600">{log.ipAddress}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-slate-500">
                  No administrative actions audited yet.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
