import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Trash2,
  Copy,
  Check,
  CornerDownLeft,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  currentPath?: string;
  isError?: boolean;
  exercisePassed?: boolean;
  timestamp: string;
}

interface TerminalProps {
  promptPrefix?: string;
  currentPath?: string;
  entries: TerminalEntry[];
  onExecute: (command: string) => Promise<void>;
  onTabComplete?: (line: string) => Promise<{
    completedLine: string;
    matches: string[];
    prefix: string;
    hasMultiple: boolean;
    isCommand: boolean;
  } | null>;
  isLoading?: boolean;
  onClear?: () => void;
  height?: string;
  title?: string;
  placeholder?: string;
}

export const Terminal: React.FC<TerminalProps> = ({
  promptPrefix = 'student@cloudlab',
  currentPath = '~',
  entries,
  onExecute,
  onTabComplete,
  isLoading = false,
  onClear,
  height = 'h-[500px]',
  title = 'Interactive Virtual Lab Console',
  placeholder = 'Type an allowlisted command (e.g. "help", "pwd", "ls")...',
}) => {
  const [inputVal, setInputVal] = useState('');
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, isLoading]);

  // Keep input focused
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd || isLoading) return;

    // Handle local clear
    if (cmd === 'clear') {
      setInputVal('');
      if (onClear) onClear();
      return;
    }

    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(null);
    setInputVal('');

    await onExecute(cmd);
  };

  // Keyboard navigation for command history (Up / Down arrows) & Tab Autocompletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (!onTabComplete || isLoading) return;

      onTabComplete(inputVal)
        .then((result) => {
          if (!result) return;
          if (result.completedLine) {
            setInputVal(result.completedLine);
            setTimeout(() => {
              if (inputRef.current) {
                const len = result.completedLine.length;
                inputRef.current.setSelectionRange(len, len);
                inputRef.current.focus();
              }
            }, 0);
          }
        })
        .catch(() => {
          // Graceful fallback on network glitch
        });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;

      const nextIndex =
        historyIndex === null
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInputVal(commandHistory[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === null) return;

      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        setHistoryIndex(null);
        setInputVal('');
      } else {
        setHistoryIndex(nextIndex);
        setInputVal(commandHistory[nextIndex] || '');
      }
    }
  };

  const handleCopyAll = () => {
    const text = entries
      .map(
        (e) =>
          `${promptPrefix}:${e.currentPath || currentPath}$ ${e.command}\n${e.output}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={handleTerminalClick}
      className={`flex flex-col bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs ${height}`}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 select-none">
        <div className="flex items-center gap-2">
          {/* macOS traffic light circles */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-semibold tracking-wide text-[11px]">
            {title}
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            (Simulated Sandbox)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyAll();
            }}
            title="Copy Terminal Output"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          {onClear && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              title="Clear Terminal Screen"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body Screen */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scroll-smooth">
        {/* Welcome Banner */}
        <div className="text-slate-500 border-b border-slate-800/80 pb-3 leading-relaxed">
          <p className="text-cyan-400 font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            CloudLab OS Terminal Simulator [Version 1.0.0]
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            All commands run inside an isolated educational sandbox with zero host OS access.
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Type <span className="text-cyan-300">help</span> for allowed commands. Use Up/Down arrows for history.
          </p>
        </div>

        {/* History Entries */}
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            {/* Prompt + Command */}
            <div className="flex items-start gap-2 text-slate-300">
              <span className="text-emerald-400 font-semibold shrink-0">
                {promptPrefix}
                <span className="text-slate-500">:</span>
                <span className="text-cyan-400 font-medium">{entry.currentPath || currentPath}</span>
                <span className="text-slate-400">$</span>
              </span>
              <span className="text-white font-medium break-all">{entry.command}</span>
            </div>

            {/* Output */}
            {entry.output && (
              <div
                className={`pl-2 border-l-2 ${
                  entry.isError
                    ? 'border-rose-500 text-rose-300 bg-rose-950/10'
                    : entry.exercisePassed
                    ? 'border-emerald-500 text-emerald-300 bg-emerald-950/10'
                    : 'border-slate-800 text-slate-300'
                } py-1 pr-2 rounded-r whitespace-pre-wrap leading-relaxed text-[11px]`}
              >
                {entry.output}
              </div>
            )}
          </div>
        ))}

        {/* Loading Spinner in Terminal */}
        {isLoading && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="animate-pulse">Processing simulated command...</span>
          </div>
        )}

        {/* Active Command Line Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
          <span className="text-emerald-400 font-semibold shrink-0">
            {promptPrefix}
            <span className="text-slate-500">:</span>
            <span className="text-cyan-400 font-medium">{currentPath}</span>
            <span className="text-slate-400">$</span>
          </span>

          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={entries.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent text-white focus:outline-none placeholder-slate-600 caret-cyan-400 text-xs disabled:opacity-50"
            autoFocus
            autoComplete="off"
            spellCheck="false"
          />

          <button
            type="submit"
            disabled={isLoading || !inputVal.trim()}
            className="text-slate-500 hover:text-cyan-400 transition p-1 disabled:opacity-30"
            title="Execute"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>

        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default Terminal;
