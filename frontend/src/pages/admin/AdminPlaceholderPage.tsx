import React from 'react';
import { ShieldAlert, Clock, ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const AdminPlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({
  title,
  subtitle,
}) => {
  const location = useLocation();

  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-purple-500/5">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-mono font-medium mb-3">
        <Clock className="w-3.5 h-3.5" />
        Phase 4 — Module 4: Admin Governance UI
      </div>

      <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>

      <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
        {subtitle}
      </p>

      <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-purple-300 inline-block">
        Route: {location.pathname} • Protected: ADMIN Role
      </div>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/admin"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
        >
          Return to Admin Console
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default AdminPlaceholderPage;
