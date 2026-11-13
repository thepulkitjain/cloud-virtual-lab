import React from 'react';
import { Terminal, Shield } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Initializing secure virtual laboratory session...',
}) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        {/* Animated outer ring */}
        <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 border-t-cyan-400 animate-spin" />
        {/* Core icons */}
        <div className="absolute inset-0 flex items-center justify-center gap-1">
          <Terminal className="w-6 h-6 text-cyan-400 animate-pulse" />
          <Shield className="w-5 h-5 text-indigo-400 animate-pulse" />
        </div>
      </div>
      <h2 className="mt-6 text-base font-semibold text-slate-100 tracking-wide">
        Cloud Virtual Lab & Secure Storage
      </h2>
      <p className="mt-2 text-xs text-slate-400 animate-pulse font-mono">{message}</p>
    </div>
  );
};

export default LoadingScreen;
