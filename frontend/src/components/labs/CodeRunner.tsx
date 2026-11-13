import React, { useState } from 'react';
import { Code2, Play, FileCode } from 'lucide-react';

interface CodeRunnerProps {
  onRunCode: (command: string) => void;
  disabled?: boolean;
}

export const CodeRunner: React.FC<CodeRunnerProps> = ({ onRunCode, disabled }) => {
  const [language, setLanguage] = useState<'python' | 'javascript'>('python');

  const pythonTemplates = [
    {
      title: 'Sum Function (app.py)',
      cmd: 'python3 app.py',
    },
    {
      title: 'Run Script (script.py)',
      cmd: 'python3 script.py',
    },
    {
      title: 'Inline Print',
      cmd: 'python3 -c "print(\'Hello from CloudLab Python\')"',
    },
  ];

  const jsTemplates = [
    {
      title: 'Run Service (app.js)',
      cmd: 'node app.js',
    },
    {
      title: 'Run Index (index.js)',
      cmd: 'node index.js',
    },
    {
      title: 'Console Log',
      cmd: 'node -e "console.log(\'Hello from Node.js Runtime\')"',
    },
  ];

  const currentTemplates = language === 'python' ? pythonTemplates : jsTemplates;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-amber-400" />
          <h4 className="font-bold text-white">Programming Execution Helper</h4>
        </div>

        {/* Language Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setLanguage('python')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              language === 'python'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Python 3
          </button>
          <button
            type="button"
            onClick={() => setLanguage('javascript')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              language === 'javascript'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Node.js / JS
          </button>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Execution Shortcuts
        </p>
        <div className="flex flex-wrap gap-2">
          {currentTemplates.map((t, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => onRunCode(t.cmd)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-slate-300 hover:text-white transition cursor-pointer font-mono text-[11px] disabled:opacity-50"
            >
              <Play className="w-3 h-3 text-amber-400" />
              {t.title}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 text-[11px] text-amber-300 flex items-start gap-2">
        <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Code scripts are parsed by safe simulator engines without exposing the host operating system or allowing untrusted process execution.
        </p>
      </div>
    </div>
  );
};

export default CodeRunner;
