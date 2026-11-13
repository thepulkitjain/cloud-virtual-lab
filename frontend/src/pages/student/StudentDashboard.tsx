import React from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal,
  HardDrive,
  Network,
  Code2,
  Database,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Clock,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const StudentDashboard: React.FC = () => {
  const { user } = useAuth();

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

  const labModules = [
    {
      title: 'Linux CLI Simulator',
      category: 'Operating Systems',
      description: 'Practice Unix directory navigation, file creation, piping, and permissions safely.',
      icon: Terminal,
      color: 'from-cyan-500 to-blue-500',
      badge: 'Linux Terminal',
    },
    {
      title: 'Networking Diagnostics',
      category: 'Computer Networks',
      description: 'Run simulated packet diagnostics: ping, traceroute, and DNS hostname resolutions.',
      icon: Network,
      color: 'from-emerald-500 to-teal-500',
      badge: 'Network Tools',
    },
    {
      title: 'Python & JS Programming',
      category: 'Software Engineering',
      description: 'Solve structured algorithm challenges with automated test evaluation.',
      icon: Code2,
      color: 'from-amber-500 to-orange-500',
      badge: 'Algorithms',
    },
    {
      title: 'SQL Database Simulator',
      category: 'Database Management',
      description: 'Write DDL schema definitions and query relational student data.',
      icon: Database,
      color: 'from-purple-500 to-indigo-500',
      badge: 'Relational SQL',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-900/40 via-indigo-900/30 to-slate-900 border border-slate-800 p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-mono font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Student Workspace Online
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.firstName} {user?.lastName}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your virtual laboratory environment and AES-256-GCM encrypted cloud storage are ready.
            Explore interactive CLI exercises or manage your course files securely.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Storage Quota Card */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Cloud Storage Quota</span>
            <HardDrive className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">
              {formatBytes(used)}{' '}
              <span className="text-xs font-normal text-slate-400 font-sans">
                / {formatBytes(quota)}
              </span>
            </div>
            {/* Progress track */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
                style={{ width: `${Math.max(percentage, 3)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-mono">
              {percentage}% allocated • AES-256-GCM
            </p>
          </div>
        </div>

        {/* Academic Profile Card */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Academic Status</span>
            <GraduationCap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-lg font-bold text-white truncate">
              {user?.profile?.department || 'Computer Science'}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Semester {user?.profile?.semester || 6} • Roll: {user?.profile?.studentId || 'Pending'}
            </p>
            <div className="mt-2.5">
              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active Enrollment
              </span>
            </div>
          </div>
        </div>

        {/* Available Labs */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Laboratory Suites</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-white">4 Modules</div>
            <p className="text-xs text-slate-400 mt-1">Linux, Networking, Code &amp; SQL</p>
            <div className="mt-2.5">
              <span className="text-[10px] text-slate-400 font-mono">All 4 ready to launch</span>
            </div>
          </div>
        </div>

        {/* Security & Integrity */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Session Security</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-400 font-mono">HTTP-Only Verified</div>
            <p className="text-xs text-slate-400 mt-1">Role: {user?.role}</p>
            <div className="mt-2.5 text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              {user?.email}
            </div>
          </div>
        </div>
      </div>

      {/* Virtual Laboratories Launch Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Interactive Virtual Laboratories</h2>
            <p className="text-xs text-slate-400">Launch a safe, sandboxed simulated environment</p>
          </div>
          <Link
            to="/labs"
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            Browse All Labs
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {labModules.map((lab, index) => {
            const Icon = lab.icon;
            return (
              <div
                key={index}
                className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${lab.color} flex items-center justify-center shadow-md`}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                      {lab.badge}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {lab.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{lab.description}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">{lab.category}</span>
                  <Link
                    to="/labs"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 group-hover:text-cyan-300 transition-colors"
                  >
                    Open Simulator
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cloud Storage Quick Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/10">
            <HardDrive className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Secure Encrypted Cloud Storage</h3>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Store laboratory exercise files, source code, and documents with AES-256-GCM authenticated
              encryption. Hierarchical folder organization and safe direct downloads.
            </p>
          </div>
        </div>
        <Link
          to="/storage"
          className="shrink-0 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center gap-2 transition"
        >
          Manage Storage
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default StudentDashboard;
