import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Play,
  Award,
  Sparkles,
} from 'lucide-react';
import { LabExercise } from '../../types/lab.types';

interface ExerciseSidebarProps {
  exercises: LabExercise[];
  activeExerciseId: string | null;
  onSelectExercise: (id: string) => void;
  passedExerciseIds: Set<string>;
  score: number;
  onInsertCommand?: (cmd: string) => void;
}

export const ExerciseSidebar: React.FC<ExerciseSidebarProps> = ({
  exercises,
  activeExerciseId,
  onSelectExercise,
  passedExerciseIds,
  score,
  onInsertCommand,
}) => {
  const [showHint, setShowHint] = useState<Record<string, boolean>>({});

  const toggleHint = (id: string) => {
    setShowHint((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const activeExercise =
    exercises.find((e) => e.id === activeExerciseId) || exercises[0];

  const totalExercises = exercises.length;
  const passedCount = passedExerciseIds.size;
  const progressPercent = totalExercises > 0 ? Math.round((passedCount / totalExercises) * 100) : 0;

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 h-full space-y-4">
      {/* Header & Score Bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-400" />
            Exercises &amp; Progress
          </span>
          <span className="text-xs font-mono font-bold text-cyan-400">
            {passedCount}/{totalExercises} Done ({score}%)
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.max(progressPercent, 4)}%` }}
          />
        </div>
      </div>

      {/* Exercise Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {exercises.map((ex, index) => {
          const isPassed = passedExerciseIds.has(ex.id);
          const isActive = ex.id === (activeExercise?.id || '');

          return (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : isPassed
                  ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {isPassed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>Ex {index + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Active Exercise Detail Card */}
      {activeExercise && (
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-white text-sm">
                {activeExercise.orderIndex}. {activeExercise.title}
              </h3>
              {passedExerciseIds.has(activeExercise.id) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  PASSED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  IN PROGRESS
                </span>
              )}
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              {activeExercise.instruction}
            </p>

            {/* Expected Command Shortcut if available */}
            {activeExercise.expectedCommand && onInsertCommand && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">Suggested Target:</span>
                <button
                  type="button"
                  onClick={() => onInsertCommand(activeExercise.expectedCommand!)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 hover:text-white hover:bg-cyan-900/60 transition text-[11px] font-mono cursor-pointer"
                >
                  <Play className="w-3 h-3 text-cyan-400" />
                  {activeExercise.expectedCommand}
                </button>
              </div>
            )}
          </div>

          {/* Hint Accordion */}
          {activeExercise.hint && (
            <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/40">
              <button
                type="button"
                onClick={() => toggleHint(activeExercise.id)}
                className="w-full flex items-center justify-between p-3 text-left text-xs font-medium text-slate-400 hover:text-white transition"
              >
                <span className="flex items-center gap-2 text-cyan-400">
                  <HelpCircle className="w-4 h-4" />
                  Need a Hint?
                </span>
                {showHint[activeExercise.id] ? (
                  <ChevronUp className="w-4 h-4 text-slate-500" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                )}
              </button>
              {showHint[activeExercise.id] && (
                <div className="px-3 pb-3 text-xs text-slate-300 bg-slate-950/60 leading-relaxed border-t border-slate-800/50 pt-2 font-mono text-[11px]">
                  💡 {activeExercise.hint}
                </div>
              )}
            </div>
          )}

          {/* Quick Learning Note */}
          <div className="p-3 rounded-xl bg-slate-950/30 border border-slate-800/40 text-[11px] text-slate-400 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              When your command meets the expected pattern or output, the exercise will automatically mark as
              <span className="text-emerald-400 font-semibold"> PASSED</span> and increment your score.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseSidebar;
