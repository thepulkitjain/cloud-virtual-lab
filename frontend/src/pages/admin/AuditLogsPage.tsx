import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  ShieldAlert,
  Activity,
  Search,
  Filter,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Eye,
  X,
  Shield,
  GraduationCap,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import AdminService from '../../services/admin.service';
import { AuditLogItem, ActivityLogItem } from '../../types/admin.types';

export const AuditLogsPage: React.FC = () => {
  const { error } = useToast();

  // Active Tab: 'audit' | 'activities'
  const [activeTab, setActiveTab] = useState<'audit' | 'activities'>('audit');

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditAction, setAuditAction] = useState<string>('');
  const [auditEntity, setAuditEntity] = useState<string>('ALL');
  const [auditStartDate, setAuditStartDate] = useState<string>('');
  const [auditEndDate, setAuditEndDate] = useState<string>('');
  const [auditPage, setAuditPage] = useState<number>(1);
  const [totalAuditPages, setTotalAuditPages] = useState<number>(1);
  const [totalAuditCount, setTotalAuditCount] = useState<number>(0);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(true);

  // Activities State
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [activityAction, setActivityAction] = useState<string>('');
  const [activityStartDate, setActivityStartDate] = useState<string>('');
  const [activityEndDate, setActivityEndDate] = useState<string>('');
  const [activityPage, setActivityPage] = useState<number>(1);
  const [totalActivityPages, setTotalActivityPages] = useState<number>(1);
  const [totalActivityCount, setTotalActivityCount] = useState<number>(0);
  const [isLoadingActivities, setIsLoadingActivities] = useState<boolean>(true);

  // Diff Modal
  const [inspectedAuditLog, setInspectedAuditLog] = useState<AuditLogItem | null>(null);

  // Refresh spinner
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoadingAudit(true);

      try {
        const res = await AdminService.listAuditLogs({
          action: auditAction.trim() || undefined,
          targetEntity: auditEntity === 'ALL' ? undefined : auditEntity,
          startDate: auditStartDate || undefined,
          endDate: auditEndDate || undefined,
          page: auditPage,
          limit: 15,
        });

        setAuditLogs(res.auditLogs);
        setTotalAuditPages(res.pagination.totalPages || 1);
        setTotalAuditCount(res.pagination.totalLogs || 0);
      } catch (err: any) {
        console.error('Failed to load audit logs:', err);
        error(err.response?.data?.message || 'Failed to retrieve administrative audit trail.');
      } finally {
        setIsLoadingAudit(false);
        setIsRefreshing(false);
      }
    },
    [auditAction, auditEntity, auditStartDate, auditEndDate, auditPage, error]
  );

  // Fetch Activities
  const fetchActivities = useCallback(
    async (isManual = false) => {
      if (isManual) setIsRefreshing(true);
      else setIsLoadingActivities(true);

      try {
        const res = await AdminService.listActivities({
          action: activityAction.trim() || undefined,
          startDate: activityStartDate || undefined,
          endDate: activityEndDate || undefined,
          page: activityPage,
          limit: 15,
        });

        setActivities(res.activities);
        setTotalActivityPages(res.pagination.totalPages || 1);
        setTotalActivityCount(res.pagination.totalActivities || 0);
      } catch (err: any) {
        console.error('Failed to load activity logs:', err);
        error(err.response?.data?.message || 'Failed to retrieve platform user activities.');
      } finally {
        setIsLoadingActivities(false);
        setIsRefreshing(false);
      }
    },
    [activityAction, activityStartDate, activityEndDate, activityPage, error]
  );

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    } else {
      fetchActivities();
    }
  }, [activeTab, fetchAuditLogs, fetchActivities]);

  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const tryParseJson = (str?: string | null) => {
    if (!str) return null;
    try {
      return JSON.stringify(JSON.parse(str), null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono font-medium mb-2">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Immutable Audit Trail &amp; System Events
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit &amp; System Logs</h1>
          <p className="text-xs text-slate-400 mt-1">
            Review detailed records of privileged administrative actions and real-time student platform operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => (activeTab === 'audit' ? fetchAuditLogs(true) : fetchActivities(true))}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 flex items-center gap-2 transition relative ${
            activeTab === 'audit'
              ? 'text-amber-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Administrative Audit Trail
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {totalAuditCount}
          </span>
          {activeTab === 'audit' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`pb-3 flex items-center gap-2 transition relative ${
            activeTab === 'activities'
              ? 'text-cyan-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          User Platform Activities
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {totalActivityCount}
          </span>
          {activeTab === 'activities' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full" />
          )}
        </button>
      </div>

      {/* ----------------- TAB 1: ADMINISTRATIVE AUDIT TRAIL ----------------- */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Filters */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by action (e.g. USER_STATUS_UPDATE, LAB_CREATE)..."
                value={auditAction}
                onChange={(e) => {
                  setAuditAction(e.target.value);
                  setAuditPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Entity Filter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400 text-[11px]">Target:</span>
                <select
                  value={auditEntity}
                  onChange={(e) => {
                    setAuditEntity(e.target.value);
                    setAuditPage(1);
                  }}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">All Entities</option>
                  <option value="USER" className="bg-slate-900">USER</option>
                  <option value="LABORATORY" className="bg-slate-900">LABORATORY</option>
                  <option value="LAB_EXERCISE" className="bg-slate-900">LAB_EXERCISE</option>
                  <option value="STORED_FILE" className="bg-slate-900">STORED_FILE</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => {
                    setAuditStartDate(e.target.value);
                    setAuditPage(1);
                  }}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => {
                    setAuditEndDate(e.target.value);
                    setAuditPage(1);
                  }}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            {isLoadingAudit ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading administrative audit records...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-16 text-center">
                <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">No audit records found</p>
                <p className="text-xs text-slate-400 mt-1">
                  No administrative actions match your current filter parameters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3">Administrator</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Target Entity</th>
                      <th className="py-3 px-3">Target ID</th>
                      <th className="py-3 px-3">IP Address</th>
                      <th className="py-3 px-4 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-white">{log.admin.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{log.admin.email}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {log.targetEntity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                          {log.targetId ? `${log.targetId.slice(0, 12)}...` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                          {log.ipAddress || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setInspectedAuditLog(log)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Inspect Diff & Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing <span className="font-semibold text-white">{auditLogs.length}</span> of{' '}
                <span className="font-semibold text-white">{totalAuditCount}</span> audited events
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                  disabled={auditPage <= 1 || isLoadingAudit}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-slate-300">
                  Page {auditPage} of {totalAuditPages}
                </span>
                <button
                  onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                  disabled={auditPage >= totalAuditPages || isLoadingAudit}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TAB 2: SYSTEM ACTIVITIES ----------------- */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          {/* Activities Filter */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter by action keyword (e.g. LOGIN, LAB_START, FILE_UPLOAD)..."
                value={activityAction}
                onChange={(e) => {
                  setActivityAction(e.target.value);
                  setActivityPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Start Date */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={activityStartDate}
                  onChange={(e) => {
                    setActivityStartDate(e.target.value);
                    setActivityPage(1);
                  }}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none"
                />
              </div>

              {/* End Date */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={activityEndDate}
                  onChange={(e) => {
                    setActivityEndDate(e.target.value);
                    setActivityPage(1);
                  }}
                  className="bg-transparent text-slate-200 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Activities Table */}
          <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden">
            {isLoadingActivities ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-400">Loading user activities...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="py-16 text-center">
                <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-white">No platform activities found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust date parameters or clear filters to view recorded actions.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-medium">
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3">User</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Action</th>
                      <th className="py-3 px-3">Details</th>
                      <th className="py-3 px-4 text-right">Origin IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {activities.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                          {formatDate(act.createdAt)}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-white">{act.user.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{act.user.email}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                              act.user.role === 'ADMIN'
                                ? 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                                : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            }`}
                          >
                            {act.user.role === 'ADMIN' ? (
                              <Shield className="w-2.5 h-2.5" />
                            ) : (
                              <GraduationCap className="w-2.5 h-2.5" />
                            )}
                            {act.user.role}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {act.action}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate text-[11px]">
                          {act.details || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[10px] text-slate-500">
                          {act.ipAddress || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>
                Showing <span className="font-semibold text-white">{activities.length}</span> of{' '}
                <span className="font-semibold text-white">{totalActivityCount}</span> recorded events
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                  disabled={activityPage <= 1 || isLoadingActivities}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-mono text-slate-300">
                  Page {activityPage} of {totalActivityPages}
                </span>
                <button
                  onClick={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                  disabled={activityPage >= totalActivityPages || isLoadingActivities}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: AUDIT DIFF & DETAILS ----------------- */}
      {inspectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-xs">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Administrative Audit Event</h3>
                  <p className="text-[11px] text-slate-400">Action: {inspectedAuditLog.action}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectedAuditLog(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-500">Administrator:</span>
                  <p className="font-semibold text-white">
                    {inspectedAuditLog.admin.name} ({inspectedAuditLog.admin.email})
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Timestamp:</span>
                  <p className="font-mono text-slate-300">
                    {formatDate(inspectedAuditLog.createdAt)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Target Entity:</span>
                  <p className="font-mono text-cyan-300">{inspectedAuditLog.targetEntity}</p>
                </div>
                <div>
                  <span className="text-slate-500">Target ID:</span>
                  <p className="font-mono text-purple-300">
                    {inspectedAuditLog.targetId || 'Unspecified'}
                  </p>
                </div>
              </div>

              {/* Diff View */}
              <div className="space-y-3">
                <h4 className="font-semibold text-white flex items-center gap-2 text-xs">
                  <span>State Modification Differential</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Previous Value */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-rose-400 uppercase font-mono tracking-wider font-semibold">
                      Previous Value
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-rose-500/20 text-rose-300 font-mono text-[10px] overflow-x-auto max-h-60 whitespace-pre-wrap">
                      {tryParseJson(inspectedAuditLog.previousVal) || 'null / none'}
                    </pre>
                  </div>

                  {/* New Value */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase font-mono tracking-wider font-semibold">
                      New Value
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 text-emerald-300 font-mono text-[10px] overflow-x-auto max-h-60 whitespace-pre-wrap">
                      {tryParseJson(inspectedAuditLog.newVal) || 'null / none'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex justify-end">
              <button
                onClick={() => setInspectedAuditLog(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogsPage;
