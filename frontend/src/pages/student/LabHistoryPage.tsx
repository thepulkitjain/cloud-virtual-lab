import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  Layers,
  History,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LabSession } from '../../types/lab.types';
import LabService from '../../services/lab.service';
import { useToast } from '../../contexts/ToastContext';

export const LabHistoryPage: React.FC = () => {
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<string, LabSession>>({});
  const [loadingDetailsId, setLoadingDetailsId] = useState<string | null>(null);

  const { error } = useToast();
  const navigate = useNavigate();

  const handleToggleAttempts = async (sessionId: string) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (sessionDetails[sessionId]) return;

    setLoadingDetailsId(sessionId);
    try {
      const details = await LabService.getSession(sessionId);
      setSessionDetails((prev) => ({ ...prev, [sessionId]: details }));
    } catch (err: any) {
      error(err.message || 'Failed to load exercise submission attempts.');
    } finally {
      setLoadingDetailsId(null);
    }
  };

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
                  const isExpanded = expandedSessionId === s.id;
                  const details = sessionDetails[s.id];
                  const attemptCount = s._count?.submissions ?? 0;

                  return (
                    <React.Fragment key={s.id}>
                      <tr className="hover:bg-slate-800/40 transition">
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
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleAttempts(s.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition cursor-pointer"
                            >
                              <span>Attempts ({attemptCount})</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
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
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-950/60">
                          <td colSpan={6} className="px-5 py-4">
                            {loadingDetailsId === s.id ? (
                              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                                Loading exercise submission attempts...
                              </div>
                            ) : !details?.submissions || details.submissions.length === 0 ? (
                              <p className="text-xs text-slate-500 py-1">
                                No exercise submissions recorded for this session yet.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                                  Submission Attempts ({details.submissions.length})
                                </p>
                                <div className="divide-y divide-slate-800/70 rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
                                  {details.submissions.map((sub) => {
                                    const ex = details.lab?.exercises?.find(
                                      (e) => e.id === sub.exerciseId
                                    );
                                    const passed = sub.status === 'PASSED';
                                    return (
                                      <div
                                        key={sub.id}
                                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                      >
                                        <div className="space-y-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            {passed ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                <CheckCircle2 className="w-3 h-3" />
                                                PASSED
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                <XCircle className="w-3 h-3" />
                                                FAILED
                                              </span>
                                            )}
                                            <span className="font-semibold text-white">
                                              {ex?.title || 'Lab Exercise'}
                                            </span>
                                          </div>
                                          <p className="font-mono text-[11px] text-cyan-300 truncate">
                                            $ {sub.commandInput}
                                          </p>
                                          {sub.outputResult && (
                                            <p className="font-mono text-[11px] text-slate-400 truncate">
                                              {sub.outputResult}
                                            </p>
                                          )}
                                        </div>
                                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                          {formatDate(sub.submittedAt)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
