import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  Play,
  Layers,
  History,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { LabSession } from '../../types/lab.types';
import LabService from '../../services/lab.service';
import { useToast } from '../../contexts/ToastContext';

export const LabHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { error } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const data = await LabService.getMySessions();
        setSessions(data);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to retrieve session history.');
        error(err.message || 'Could not load sessions.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, [error]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/labs"
          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
          title="Back to Labs"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            My Laboratory Sessions &amp; History
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of your hands-on laboratory exercises, completion statuses, and grades
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
          <p className="text-xs font-mono">Fetching student session records...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800/60 p-8 max-w-lg mx-auto">
          <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">No Lab Sessions Found</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            You have not launched any virtual laboratory sessions yet.
          </p>
          <Link
            to="/labs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 shadow transition"
          >
            <Play className="w-3.5 h-3.5" />
            Launch First Lab
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 font-mono uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Laboratory</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Started At</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Score</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-slate-300">
                {sessions.map((s) => {
                  const isCompleted = s.status === 'COMPLETED';

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4 font-semibold text-white">
                        {s.lab?.title || 'Virtual Lab'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/50 border border-cyan-800/40 text-cyan-300">
                          {s.lab?.category}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[11px] text-slate-400">
                        {formatDate(s.startedAt)}
                      </td>
                      <td className="px-5 py-4">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            COMPLETED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400">
                            <Clock className="w-3 h-3" />
                            IN PROGRESS
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white w-9">
                            {s.score}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full"
                              style={{ width: `${Math.max(s.score, 4)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/labs/${s.lab?.id || s.labId}`, {
                              state: { sessionId: s.id },
                            })
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                        >
                          <Play className="w-3 h-3 text-cyan-400" />
                          {isCompleted ? 'Review Lab' : 'Resume Lab'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabHistoryPage;
