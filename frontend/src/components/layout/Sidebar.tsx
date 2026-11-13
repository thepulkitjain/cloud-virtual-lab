import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Terminal,
  HardDrive,
  User,
  Users,
  FlaskConical,
  Database,
  FileText,
  ShieldAlert,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role } = useAuth();
  const isAdmin = role === 'ADMIN';

  // Format bytes helper for storage bar
  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 MB';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const quota = user?.storageQuotaBytes ? parseInt(user.storageQuotaBytes, 10) : 100 * 1024 * 1024;
  const used = user?.storageStats?.usedBytes ? parseInt(user.storageStats.usedBytes, 10) : 0;
  const percentage = Math.min(100, Math.round((used / quota) * 100)) || 0;

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/labs', label: 'Virtual Laboratories', icon: Terminal },
    { to: '/storage', label: 'Secure Cloud Storage', icon: HardDrive },
    { to: '/profile', label: 'Profile & Security', icon: User },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Governance Overview', icon: LayoutDashboard },
    { to: '/admin/users', label: 'User Management', icon: Users },
    { to: '/admin/labs', label: 'Laboratory Management', icon: FlaskConical },
    { to: '/admin/storage', label: 'Storage Governance', icon: Database },
    { to: '/admin/audit-logs', label: 'Audit & System Logs', icon: FileText },
    { to: '/profile', label: 'Admin Profile', icon: User },
  ];

  const navLinks = isAdmin ? adminLinks : studentLinks;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800 bg-slate-900/50">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              CloudLab <span className="text-cyan-400 font-mono text-xs">OS</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              {isAdmin ? 'Admin Console' : 'Virtual Lab Suite'}
            </p>
          </div>
        </div>

        {/* Role Pill Indicator */}
        <div className="px-4 pt-4 pb-2">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
              isAdmin
                ? 'bg-purple-950/30 border-purple-800/40 text-purple-300'
                : 'bg-cyan-950/30 border-cyan-800/40 text-cyan-300'
            }`}
          >
            {isAdmin ? (
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
            ) : (
              <GraduationCap className="w-4 h-4 text-cyan-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold leading-none">{isAdmin ? 'Administrator' : 'Student Portal'}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Navigation
          </p>

          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/admin'}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? isAdmin
                        ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30 shadow-sm'
                        : 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-200 border border-cyan-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Storage Quota Widget (For Students) */}
        {!isAdmin && (
          <div className="p-4 mx-3 mb-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                Storage Quota
              </span>
              <span className="font-mono text-[11px] text-cyan-300 font-semibold">{percentage}%</span>
            </div>

            {/* Progress track */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  percentage > 90
                    ? 'bg-rose-500'
                    : percentage > 70
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
                }`}
                style={{ width: `${Math.max(percentage, 2)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5">
              <span>{formatBytes(used)} used</span>
              <span>{formatBytes(quota)} cap</span>
            </div>
          </div>
        )}

        {/* System Footer info */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/30 text-[10px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            BTech CS SE Lab
          </span>
          <span className="font-mono">v1.0.0</span>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
