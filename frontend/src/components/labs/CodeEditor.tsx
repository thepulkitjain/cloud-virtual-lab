import React, { useState, useRef, useMemo } from 'react';
import {
  Code2,
  Play,
  Copy,
  Check,
  RotateCcw,
  FileCode,
  Sparkles,
  UploadCloud,
  FolderOpen,
  Loader2,
  X,
} from 'lucide-react';
import { SupportedLanguage } from '../../types/lab.types';
import { StoredFile } from '../../types/storage.types';
import StorageService from '../../services/storage.service';
import {
  tokenizeCode,
  TOKEN_COLORS,
  detectLanguageFromFilename,
} from '../../utils/syntaxHighlight';

interface CodeEditorProps {
  onRunCode: (command: string, options?: { code?: string; language?: SupportedLanguage }) => void;
  disabled?: boolean;
  initialLanguage?: SupportedLanguage;
}

const STARTER_TEMPLATES: Record<SupportedLanguage, string> = {
  python: `# CloudLab Python 3 Sandbox (app.py)
def add_numbers(a, b):
    return a + b

def main():
    result = add_numbers(15, 27)
    print("Virtual Lab Python Runtime Ready: 200 OK")
    print(f"Sum Result: {result}")

if __name__ == "__main__":
    main()
`,
  javascript: `// CloudLab Node.js Runtime (index.js)
const modules = ["auth", "storage", "lab"];

function getRuntimeStatus(activeModules) {
  return {
    status: "success",
    runtime: "Node.js v20.12.2",
    modules: activeModules,
  };
}

const output = getRuntimeStatus(modules);
console.log(JSON.stringify(output, null, 2));
`,
};

const FILE_METADATA: Record<
  SupportedLanguage,
  { filename: string; runCommand: string; label: string; indent: string }
> = {
  python: {
    filename: 'app.py',
    runCommand: 'python3 app.py',
    label: 'Python 3',
    indent: '    ',
  },
  javascript: {
    filename: 'index.js',
    runCommand: 'node index.js',
    label: 'JavaScript',
    indent: '  ',
  },
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  onRunCode,
  disabled = false,
  initialLanguage = 'python',
}) => {
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage);
  const [buffers, setBuffers] = useState<Record<SupportedLanguage, string>>({
    python: STARTER_TEMPLATES.python,
    javascript: STARTER_TEMPLATES.javascript,
  });
  const [copied, setCopied] = useState(false);

  // Vault integration states
  const [isSavingVault, setIsSavingVault] = useState(false);
  const [vaultSaved, setVaultSaved] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [isLoadingVaultFiles, setIsLoadingVaultFiles] = useState(false);
  const [vaultFiles, setVaultFiles] = useState<StoredFile[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const code = buffers[language];
  const meta = FILE_METADATA[language];

  const lines = useMemo(() => code.split('\n'), [code]);
  const tokens = useMemo(() => tokenizeCode(code, language), [code, language]);

  const syncScroll = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (preRef.current) {
      preRef.current.scrollTop = textarea.scrollTop;
      preRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setBuffers((prev) => ({ ...prev, [language]: nextValue }));
  };

  const handleRun = () => {
    if (disabled) return;
    onRunCode(meta.runCommand, { code, language });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const indent = meta.indent;

      const updated = code.slice(0, start) + indent + code.slice(end);
      setBuffers((prev) => ({ ...prev, [language]: updated }));

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const nextPos = start + indent.length;
          textareaRef.current.selectionStart = nextPos;
          textareaRef.current.selectionEnd = nextPos;
        }
      });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  const handleReset = () => {
    setBuffers((prev) => ({
      ...prev,
      [language]: STARTER_TEMPLATES[language],
    }));
    setVaultError(null);
    textareaRef.current?.focus();
  };

  const handleSaveToVault = async () => {
    if (!code.trim() || isSavingVault) return;
    setIsSavingVault(true);
    setVaultError(null);
    try {
      const file = new File([code], meta.filename, { type: 'text/plain' });
      await StorageService.uploadFile(file);
      setVaultSaved(true);
      setTimeout(() => setVaultSaved(false), 2500);
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to save file to Encrypted Vault.');
    } finally {
      setIsSavingVault(false);
    }
  };

  const handleOpenVaultPicker = async () => {
    if (showVaultPicker) {
      setShowVaultPicker(false);
      return;
    }
    setShowVaultPicker(true);
    setIsLoadingVaultFiles(true);
    setVaultError(null);
    try {
      const files = await StorageService.listFiles({ category: 'CODE' });
      const supportedFiles = files.filter(
        (f) => detectLanguageFromFilename(f.originalName) !== null
      );
      setVaultFiles(supportedFiles);
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to list Encrypted Vault files.');
    } finally {
      setIsLoadingVaultFiles(false);
    }
  };

  const handleLoadVaultFile = async (file: StoredFile) => {
    setIsLoadingVaultFiles(true);
    setVaultError(null);
    try {
      const { data } = await StorageService.downloadFile(file.id);
      const text = await data.text();
      const targetLang = detectLanguageFromFilename(file.originalName) || language;
      setLanguage(targetLang);
      setBuffers((prev) => ({ ...prev, [targetLang]: text }));
      setShowVaultPicker(false);
    } catch (err: any) {
      setVaultError(err?.message || 'Failed to decrypt and load file from Vault.');
    } finally {
      setIsLoadingVaultFiles(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Code2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white">Sandbox Code Editor</h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                {meta.filename}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Language Switcher */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setLanguage('python')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                language === 'javascript'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              JavaScript
            </button>
          </div>

          {/* Open from Vault */}
          <button
            type="button"
            onClick={handleOpenVaultPicker}
            title="Open Python/JS file from Encrypted Vault"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 text-[11px] font-medium transition cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Vault</span>
          </button>

          {/* Save to Vault */}
          <button
            type="button"
            disabled={isSavingVault || !code.trim()}
            onClick={handleSaveToVault}
            title="Encrypt and save script to Cloud Storage Vault"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-emerald-300 text-[11px] font-medium transition cursor-pointer disabled:opacity-50"
          >
            {isSavingVault ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : vaultSaved ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className={vaultSaved ? 'text-emerald-400' : ''}>
              {vaultSaved ? 'Saved' : 'Save to Vault'}
            </span>
          </button>

          {/* Copy Code */}
          <button
            type="button"
            onClick={handleCopy}
            title="Copy code"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Reset Code */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset to starter template"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] font-medium transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          {/* Run Code */}
          <button
            type="button"
            disabled={disabled}
            onClick={handleRun}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-[11px] shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Run {meta.label}
          </button>
        </div>
      </div>

      {/* Vault File Picker Panel */}
      {showVaultPicker && (
        <div className="px-4 py-3 bg-slate-950/90 border-b border-slate-800 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5 text-[11px]">
              <FolderOpen className="w-3.5 h-3.5" />
              Select Encrypted Python / JavaScript File from Vault
            </span>
            <button
              type="button"
              onClick={() => setShowVaultPicker(false)}
              className="text-slate-400 hover:text-white"
              aria-label="Close vault picker"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {isLoadingVaultFiles ? (
            <div className="flex items-center gap-2 text-slate-400 py-1 text-[11px]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              Loading encrypted code files...
            </div>
          ) : vaultFiles.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-1">
              No .py or .js files found in your Cloud Storage Vault. Use &quot;Save to Vault&quot; to store scripts.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {vaultFiles.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleLoadVaultFile(f)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-cyan-300 font-mono text-[11px] transition cursor-pointer"
                >
                  <FileCode className="w-3 h-3 text-amber-400" />
                  <span>{f.originalName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vault Error Banner */}
      {vaultError && (
        <div className="px-4 py-2 bg-rose-950/40 border-b border-rose-800/40 text-rose-300 text-[11px]">
          {vaultError}
        </div>
      )}

      {/* Editor Body: Line Numbers Gutter + Synchronized Overlay */}
      <div className="relative flex h-64 bg-slate-950 font-mono text-xs">
        {/* Line Numbers Gutter */}
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="w-11 shrink-0 py-4 pr-2.5 pl-2 bg-slate-950/90 border-r border-slate-800/80 text-right text-slate-600 select-none overflow-hidden leading-6"
        >
          {lines.map((_, idx) => (
            <div key={idx}>{idx + 1}</div>
          ))}
        </div>

        {/* Synchronized Highlight Layer + Transparent Textarea */}
        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="absolute inset-0 m-0 p-4 font-mono text-xs leading-6 whitespace-pre overflow-auto pointer-events-none select-none"
            style={{ tabSize: language === 'python' ? 4 : 2 }}
          >
            {tokens.map((tok, idx) => (
              <span key={idx} className={TOKEN_COLORS[tok.type]}>
                {tok.value}
              </span>
            ))}
            {code.endsWith('\n') ? ' ' : ''}
          </pre>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label={`${meta.label} code editor`}
            className="relative z-10 w-full h-full p-4 bg-transparent text-transparent caret-cyan-400 font-mono text-xs leading-6 whitespace-pre overflow-auto resize-none focus:outline-none selection:bg-cyan-500/25"
            style={{ tabSize: language === 'python' ? 4 : 2 }}
          />
        </div>
      </div>

      {/* Footer Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-3 font-mono">
          <span className="flex items-center gap-1 text-slate-300">
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            {meta.label}
          </span>
          <span>•</span>
          <span>
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
          <span>•</span>
          <span>{code.length} chars</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-500">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>Tab: indent • Ctrl/Cmd+Enter: run</span>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
