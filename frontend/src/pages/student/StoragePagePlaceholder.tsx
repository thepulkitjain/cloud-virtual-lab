import React from 'react';
import { HardDrive, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const StoragePagePlaceholder: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center mb-6 shadow-xl shadow-cyan-500/5">
        <HardDrive className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-mono font-medium mb-3">
        <Clock className="w-3.5 h-3.5" />
        Phase 4 — Module 3
      </div>

      <h1 className="text-2xl font-bold text-white tracking-tight">
        Secure Cloud Storage Management
      </h1>

      <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed max-w-lg mx-auto">
        Authentication and session foundation are complete! The AES-256-GCM file explorer,
        drag-and-drop uploader, folder hierarchy, and quota monitor will be attached in Phase 4 — Module 3.
      </p>

      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
        >
          Return to Dashboard
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default StoragePagePlaceholder;
