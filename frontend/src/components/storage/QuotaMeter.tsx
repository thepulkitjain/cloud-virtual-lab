import React from 'react';
import { HardDrive, ShieldCheck } from 'lucide-react';
import { StorageQuotaResponse } from '../../types/storage.types';

interface QuotaMeterProps {
  quota: StorageQuotaResponse | null;
  className?: string;
}

export const QuotaMeter: React.FC<QuotaMeterProps> = ({ quota, className = '' }) => {
  const formatBytes = (bytesStr?: string | number) => {
    if (!bytesStr) return '0 B';
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${mb.toFixed(1)} MB`;
  };

  const used = quota?.usedBytes ? parseInt(quota.usedBytes, 10) : 0;
  const total = quota?.quotaBytes ? parseInt(quota.quotaBytes, 10) : 100 * 1024 * 1024;
  const available = quota?.availableBytes ? parseInt(quota.availableBytes, 10) : total - used;
  const percentage = quota?.percentageUsed ?? Math.min(100, Math.round((used / total) * 100));

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-rose-500';
    if (percentage >= 70) return 'bg-amber-500';
    return 'bg-gradient-to-r from-cyan-400 to-indigo-500';
  };

  return (
    <div className={`p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Encrypted Storage Quota
            </h3>
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              AES-256-GCM At Rest
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-sm font-mono font-bold text-cyan-300">{percentage}%</span>
          <span className="text-[10px] text-slate-500 block font-mono">Capacity</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
        <div>
          <span className="text-slate-500 block text-[10px]">USED</span>
          <span className="text-slate-200 font-semibold">{formatBytes(used)}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">AVAILABLE</span>
          <span className="text-emerald-400 font-semibold">{formatBytes(available)}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[10px]">TOTAL CAP</span>
          <span className="text-slate-400 font-semibold">{formatBytes(total)}</span>
        </div>
      </div>
    </div>
  );
};

export default QuotaMeter;
