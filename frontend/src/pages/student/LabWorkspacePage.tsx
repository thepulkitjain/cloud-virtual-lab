import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  StopCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Lab, LabSession, LabExercise } from '../../types/lab.types';
import LabService from '../../services/lab.service';
import Terminal, { TerminalEntry } from '../../components/labs/Terminal';
import ExerciseSidebar from '../../components/labs/ExerciseSidebar';
import SqlPlayground from '../../components/labs/SqlPlayground';
import NetworkingConsole from '../../components/labs/NetworkingConsole';
import CodeRunner from '../../components/labs/CodeRunner';
import { useToast } from '../../contexts/ToastContext';

export const LabWorkspacePage: React.FC = () => {
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const navigate = useNavigate();
  const { success, error, warning } = useToast();

  const [lab, setLab] = useState<Lab | null>(null);
  const [session, setSession] = useState<LabSession | null>(null);
  const [exercises, setExercises] = useState<LabExercise[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [passedExerciseIds, setPassedExerciseIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState<number>(0);
  const [currentPath, setCurrentPath] = useState<string>('/home/student');

  // Terminal state
  const [terminalEntries, setTerminalEntries] = useState<TerminalEntry[]>([]);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isLoadingLab, setIsLoadingLab] = useState<boolean>(true);
  const [isEndingSession, setIsEndingSession] = useState<boolean>(false);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Initialize or resume session
  const initializeWorkspace = useCallback(async () => {
    if (!idOrSlug) return;
    setIsLoadingLab(true);
    setLoadError(null);

    try {
      // 1. Get Lab details
      const labData = await LabService.getLab(idOrSlug);
      setLab(labData);

      const labExercises = labData.exercises || [];
      setExercises(labExercises);
      if (labExercises.length > 0) {
        setActiveExerciseId(labExercises[0].id);
      }

      // 2. Start or resume session
      const sessionResult = await LabService.startSession(labData.id);
      const activeSession = sessionResult.session;
      setSession(activeSession);
      setScore(activeSession.score || 0);

      // Check existing passed submissions
      if (activeSession.submissions && activeSession.submissions.length > 0) {
        const passedSet = new Set<string>();
        activeSession.submissions.forEach((sub: any) => {
          if (sub.status === 'PASSED') {
            passedSet.add(sub.exerciseId);
          }
        });
        setPassedExerciseIds(passedSet);
      }

      // Initial welcoming terminal banner
      setTerminalEntries([
        {
          id: 'init-1',
          command: 'uname -a',
          output: `Linux cloudlab-node-01 6.8.0-cloud-generic #1 SMP x86_64 GNU/Linux\nSession attached to ${labData.title}. Type 'help' for available commands.`,
          currentPath: labData.category === 'LINUX' ? '/home/student' : '~',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to initialize lab workspace.');
      error(err.message || 'Error loading lab session.');
    } finally {
      setIsLoadingLab(false);
    }
  }, [idOrSlug, error]);

  useEffect(() => {
    initializeWorkspace();
  }, [initializeWorkspace]);

  // Execute command inside the isolated virtual simulator
  const handleExecute = async (command: string) => {
    if (!session) {
      warning('Session is not active. Please refresh the page.');
      return;
    }

    setIsExecuting(true);
    try {
      const result = await LabService.executeCommand(session.id, {
        command,
        exerciseId: activeExerciseId || undefined,
      });

      if (result.currentPath) {
        setCurrentPath(result.currentPath);
      }

      // Check if command passed exercise criteria
      if (result.exercisePassed && activeExerciseId) {
        setPassedExerciseIds((prev) => new Set([...prev, activeExerciseId]));
        setScore(result.currentScore);
        success(
          result.feedbackMessage || 'Exercise requirements verified and passed!',
          'Exercise Passed! +Score'
        );
      }

      // Append entry to terminal history
      const newEntry: TerminalEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        command,
        output: result.output,
        currentPath: result.currentPath || currentPath,
        isError: result.isError,
        exercisePassed: result.exercisePassed,
        timestamp: new Date().toLocaleTimeString(),
      };

      setTerminalEntries((prev) => [...prev, newEntry]);
    } catch (err: any) {
      const errorEntry: TerminalEntry = {
        id: `${Date.now()}-err`,
        command,
        output: `Error: ${err.message || 'Execution error'}`,
        currentPath,
        isError: true,
        timestamp: new Date().toLocaleTimeString(),
      };
      setTerminalEntries((prev) => [...prev, errorEntry]);
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Tab Autocompletion inside simulated Linux VFS
  const handleTabComplete = async (line: string) => {
    if (!session || lab?.category !== 'LINUX') return null;
    try {
      const result = await LabService.tabComplete(session.id, line);
      if (result.hasMultiple && result.matches.length > 0) {
        // Display candidates in terminal output like standard bash
        const matchEntry: TerminalEntry = {
          id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          command: line,
          output: result.matches.join('  '),
          currentPath,
          timestamp: new Date().toLocaleTimeString(),
        };
        setTerminalEntries((prev) => [...prev, matchEntry]);
      }
      return result;
    } catch {
      return null;
    }
  };

  // End and complete the lab session
  const handleEndSession = async () => {
    if (!session) return;
    setIsEndingSession(true);
    try {
      await LabService.endSession(session.id);
      setShowCompletionModal(true);
    } catch (err: any) {
      error(err.message || 'Failed to end session.');
    } finally {
      setIsEndingSession(false);
    }
  };

  if (isLoadingLab) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <h3 className="text-sm font-semibold">Attaching to Simulated Environment...</h3>
        <p className="text-xs text-slate-500 font-mono">
          Restoring VFS state machine &amp; exercise checkpoints
        </p>
      </div>
    );
  }

  if (loadError || !lab) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Laboratory Unavailable</h2>
        <p className="text-xs text-slate-400">{loadError || 'Could not load this laboratory.'}</p>
        <Link
          to="/labs"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to Laboratory Catalog
        </Link>
      </div>
    );
  }

  const promptPrefix =
    lab.category === 'DATABASE'
      ? 'postgres@cloudlab'
      : lab.category === 'NETWORKING'
      ? 'netadmin@cloudlab'
      : 'student@cloudlab';

  return (
    <div className="space-y-4">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            to="/labs"
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Back to Catalog"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {lab.title}
              </h1>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                {lab.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-3 mt-0.5 font-mono text-[11px]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                ~{lab.estimatedMinutes} mins
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-500" />
                {exercises.length} Exercises
              </span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Award className="w-3 h-3" />
                Score: {score}%
              </span>
            </p>
          </div>
        </div>

        {/* End Session Button */}
        <button
          type="button"
          disabled={isEndingSession}
          onClick={handleEndSession}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 shadow transition cursor-pointer"
        >
          {isEndingSession ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <StopCircle className="w-3.5 h-3.5" />
          )}
          End Session &amp; Submit Score
        </button>
      </div>

      {/* Main Workspace Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left Column (2 Cols): Terminal + Companion */}
        <div className="lg:col-span-2 space-y-4">
          <Terminal
            title={`${lab.title} — Virtual Terminal`}
            promptPrefix={promptPrefix}
            currentPath={currentPath}
            entries={terminalEntries}
            onExecute={handleExecute}
            onTabComplete={handleTabComplete}
            isLoading={isExecuting}
            onClear={() => setTerminalEntries([])}
            height="h-[480px]"
          />

          {/* Category-Specific Companion Panel */}
          {lab.category === 'DATABASE' && (
            <SqlPlayground onRunQuery={handleExecute} disabled={isExecuting} />
          )}
          {lab.category === 'NETWORKING' && (
            <NetworkingConsole onRunCommand={handleExecute} disabled={isExecuting} />
          )}
          {lab.category === 'PROGRAMMING' && (
            <CodeRunner onRunCode={handleExecute} disabled={isExecuting} />
          )}
        </div>

        {/* Right Column (1 Col): Exercise Navigation & Guide */}
        <div className="lg:col-span-1">
          <ExerciseSidebar
            exercises={exercises}
            activeExerciseId={activeExerciseId}
            onSelectExercise={(id) => setActiveExerciseId(id)}
            passedExerciseIds={passedExerciseIds}
            score={score}
            onInsertCommand={(cmd) => handleExecute(cmd)}
          />
        </div>
      </div>

      {/* Lab Completion Modal */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold">
                Session Completed
              </span>
              <h2 className="text-xl font-bold text-white mt-1">Laboratory Evaluation Summary</h2>
              <p className="text-xs text-slate-400 mt-1">
                Your submissions have been graded and recorded to your permanent academic record.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Final Score:</span>
                <span className="font-mono text-base font-bold text-emerald-400">{score}%</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Exercises Passed:</span>
                <span className="font-mono font-semibold text-white">
                  {passedExerciseIds.size} / {exercises.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-mono text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  COMPLETED
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/labs')}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-md transition"
              >
                Return to Laboratories
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LabWorkspacePage;
