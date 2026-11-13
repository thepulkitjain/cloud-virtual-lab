import React from 'react';
import { Link } from 'react-router-dom';
import { Terminal, Home, ArrowRight } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mx-auto flex items-center justify-center mb-6">
          <Terminal className="w-8 h-8" />
        </div>
        <span className="font-mono text-cyan-400 text-sm font-bold uppercase tracking-wider">
          404: Route Not Found
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-white">Destination Unreachable</h1>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          The simulated endpoint or web path you requested does not exist on CloudLab OS.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-md transition"
          >
            <Home className="w-4 h-4" />
            Return to Home
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
