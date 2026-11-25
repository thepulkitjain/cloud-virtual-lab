import { SupportedLanguage } from '../types/lab.types';

export type TokenType =
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'builtin'
  | 'function'
  | 'operator'
  | 'plain';

export interface Token {
  type: TokenType;
  value: string;
}

export const TOKEN_COLORS: Record<TokenType, string> = {
  comment: 'text-slate-500 italic',
  string: 'text-emerald-400',
  number: 'text-amber-300',
  keyword: 'text-purple-400 font-semibold',
  builtin: 'text-cyan-300',
  function: 'text-sky-300',
  operator: 'text-rose-300',
  plain: 'text-slate-200',
};

const PYTHON_KEYWORDS = new Set([
  'def',
  'class',
  'return',
  'if',
  'elif',
  'else',
  'for',
  'while',
  'break',
  'continue',
  'pass',
  'import',
  'from',
  'as',
  'try',
  'except',
  'finally',
  'raise',
  'with',
  'yield',
  'lambda',
  'and',
  'or',
  'not',
  'in',
  'is',
  'True',
  'False',
  'None',
  'async',
  'await',
]);

const PYTHON_BUILTINS = new Set([
  'print',
  'len',
  'range',
  'str',
  'int',
  'float',
  'list',
  'dict',
  'set',
  'tuple',
  'enumerate',
  'zip',
  'map',
  'filter',
  'sum',
  'min',
  'max',
  'open',
  'type',
  'isinstance',
]);

const JS_KEYWORDS = new Set([
  'function',
  'const',
  'let',
  'var',
  'return',
  'if',
  'else',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'switch',
  'case',
  'default',
  'import',
  'export',
  'from',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'class',
  'extends',
  'super',
  'this',
  'async',
  'await',
  'typeof',
  'instanceof',
  'of',
  'in',
  'true',
  'false',
  'null',
  'undefined',
]);

const JS_BUILTINS = new Set([
  'console',
  'log',
  'JSON',
  'stringify',
  'parse',
  'Math',
  'Array',
  'Object',
  'String',
  'Number',
  'Promise',
  'fetch',
  'setTimeout',
  'map',
  'filter',
  'reduce',
  'forEach',
]);

/**
 * Detects supported syntax highlighting language from a filename extension.
 */
export function detectLanguageFromFilename(filename: string): SupportedLanguage | null {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
    return 'javascript';
  }
  return null;
}

/**
 * Single-pass lexical tokenizer for Python and JavaScript syntax highlighting.
 */
export function tokenizeCode(code: string, language: SupportedLanguage): Token[] {
  const tokens: Token[] = [];
  const keywords = language === 'python' ? PYTHON_KEYWORDS : JS_KEYWORDS;
  const builtins = language === 'python' ? PYTHON_BUILTINS : JS_BUILTINS;

  const pattern =
    language === 'python'
      ? /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|f?"(?:\\.|[^"\\])*"|f?'(?:\\.|[^'\\])*')|\b(0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?)\b|([A-Za-z_][A-Za-z0-9_]*)(?=\s*\()|\b([A-Za-z_][A-Za-z0-9_]*)\b|(==|!=|<=|>=|\*\*|\/\/|[+\-*/%=<>!&|^~]+)/g
      : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(0x[0-9a-fA-F]+|0b[01]+|\d+(?:\.\d+)?)\b|([A-Za-z_$][A-Za-z0-9_$]*)(?=\s*\()|\b([A-Za-z_$][A-Za-z0-9_$]*)\b|(=>|===|!==|==|!=|<=|>=|\+\+|--|\+=|-=|\*=|\/=|&&|\|\||[+\-*/%=<>!&|^~?]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', value: code.slice(lastIndex, match.index) });
    }

    const [full, comment, str, num, fnCall, ident, op] = match;

    if (comment) {
      tokens.push({ type: 'comment', value: full });
    } else if (str) {
      tokens.push({ type: 'string', value: full });
    } else if (num) {
      tokens.push({ type: 'number', value: full });
    } else if (fnCall) {
      const type: TokenType = keywords.has(fnCall)
        ? 'keyword'
        : builtins.has(fnCall)
        ? 'builtin'
        : 'function';
      tokens.push({ type, value: full });
    } else if (ident) {
      const type: TokenType = keywords.has(ident)
        ? 'keyword'
        : builtins.has(ident)
        ? 'builtin'
        : 'plain';
      tokens.push({ type, value: full });
    } else if (op) {
      tokens.push({ type: 'operator', value: full });
    } else {
      tokens.push({ type: 'plain', value: full });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < code.length) {
    tokens.push({ type: 'plain', value: code.slice(lastIndex) });
  }

  return tokens;
}
