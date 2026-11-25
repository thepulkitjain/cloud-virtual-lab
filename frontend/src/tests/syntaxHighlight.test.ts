import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromFilename,
  tokenizeCode,
} from '../utils/syntaxHighlight';

describe('syntaxHighlight utility', () => {
  it('detects Python and JavaScript from filenames and ignores non-code extensions', () => {
    expect(detectLanguageFromFilename('app.py')).toBe('python');
    expect(detectLanguageFromFilename('SCRIPT.PY')).toBe('python');
    expect(detectLanguageFromFilename('index.js')).toBe('javascript');
    expect(detectLanguageFromFilename('module.mjs')).toBe('javascript');
    expect(detectLanguageFromFilename('notes.txt')).toBeNull();
    expect(detectLanguageFromFilename('report.pdf')).toBeNull();
  });

  it('tokenizes Python comments, keywords, functions, strings, numbers, and operators', () => {
    const tokens = tokenizeCode('# comment\ndef add(a):\n    return a + 42\nprint("ok")', 'python');
    expect(tokens.some((t) => t.type === 'comment' && t.value === '# comment')).toBe(true);
    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'def')).toBe(true);
    expect(tokens.some((t) => t.type === 'function' && t.value === 'add')).toBe(true);
    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'return')).toBe(true);
    expect(tokens.some((t) => t.type === 'operator' && t.value === '+')).toBe(true);
    expect(tokens.some((t) => t.type === 'number' && t.value === '42')).toBe(true);
    expect(tokens.some((t) => t.type === 'builtin' && t.value === 'print')).toBe(true);
    expect(tokens.some((t) => t.type === 'string' && t.value === '"ok"')).toBe(true);
  });

  it('tokenizes JavaScript comments, keywords, builtins, template literals, and operators', () => {
    const tokens = tokenizeCode('// js\nconst fn = (x) => `v=${x}`;', 'javascript');
    expect(tokens.some((t) => t.type === 'comment' && t.value === '// js')).toBe(true);
    expect(tokens.some((t) => t.type === 'keyword' && t.value === 'const')).toBe(true);
    expect(tokens.some((t) => t.type === 'operator' && t.value === '=>')).toBe(true);
    expect(tokens.some((t) => t.type === 'string' && t.value === '`v=${x}`')).toBe(true);
  });
});
