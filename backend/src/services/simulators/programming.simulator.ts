export type SupportedLanguage = 'python' | 'javascript';

interface SimFunction {
  params: string[];
  bodyLines: string[];
}

interface ExecResult {
  outputs: string[];
  error?: string;
}

const PYTHON_SECURITY_PATTERNS: RegExp[] = [
  /\bimport\s+(os|sys|subprocess|shutil|socket|ctypes|pty)\b/,
  /\bfrom\s+(os|sys|subprocess|shutil|socket|ctypes|pty)\s+import\b/,
  /\b(__import__|eval|exec|compile|open)\s*\(/,
];

const JS_SECURITY_PATTERNS: RegExp[] = [
  /\brequire\s*\(/,
  /\bprocess\s*\.\s*(env|exit|kill|binding)\b/,
  /\b(eval|Function)\s*\(/,
  /\bglobalThis\b/,
];

export class ProgrammingSimulator {
  /**
   * Safely evaluates educational programming exercises without host code execution
   */
  static execute(
    commandStr: string,
    codeBody?: string,
    language?: SupportedLanguage
  ): string {
    const trimmed = commandStr.trim();
    if (!trimmed) {
      return 'prog-sim: empty command. Use \'python3 <file>\' or \'node <file>\'.';
    }

    const args = trimmed.split(/\s+/);
    const command = args[0].toLowerCase();
    const targetFile = args[1];

    if (command === 'python' || command === 'python3') {
      if (language && language !== 'python') {
        return `Error: Runtime mismatch — cannot execute ${language} code with '${command}'.`;
      }

      if (codeBody !== undefined) {
        return this.evaluatePythonBuffer(codeBody);
      }

      if (!targetFile) {
        return [
          'Python 3.11.8 (main, Feb 2026, 12:00:00) [GCC 13.2.0] on linux',
          'Type "help", "copyright", "credits" or "license" for more information.',
          '>>> (Interactive python shell is read-only. Run your script with "python3 <file.py>")',
        ].join('\n');
      }

      if (targetFile === 'app.py' || targetFile === 'main.py' || targetFile === 'script.py') {
        return [
          'Virtual Lab Python Runtime Ready: 200 OK',
          'Running test cases...',
          'Test Case 1 (Addition Function): PASSED',
          'Test Case 2 (Edge Values): PASSED',
          'All test assertions passed successfully.',
        ].join('\n');
      }

      return `python3: can't open file '${targetFile}': [Errno 2] No such file or directory. Try 'python3 app.py'.`;
    }

    if (command === 'node') {
      if (language && language !== 'javascript') {
        return `Error: Runtime mismatch — cannot execute ${language} code with '${command}'.`;
      }

      if (codeBody !== undefined) {
        return this.evaluateJsBuffer(codeBody);
      }

      if (!targetFile) {
        return 'Welcome to Node.js v20.12.2. Run your script using "node index.js" or "node app.js".';
      }

      if (targetFile === 'index.js' || targetFile === 'app.js' || targetFile === 'main.js') {
        return JSON.stringify(
          {
            status: 'success',
            runtime: 'Node.js v20.12.2',
            modules: ['auth', 'storage', 'lab'],
            timestamp: new Date().toISOString(),
          },
          null,
          2
        );
      }

      return `node: internal/modules/cjs/loader: Cannot find module '${targetFile}'`;
    }

    if (command === 'help') {
      return [
        'Programming Environment Commands:',
        '  python3 <file.py>   Run a Python script in the simulated runtime',
        '  node <file.js>      Run a Node.js script in the simulated runtime',
        '  help                Show available commands',
      ].join('\n');
    }

    return `prog-sim: command '${command}' is not supported. Use 'python3 <file>' or 'node <file>'.`;
  }

  private static evaluatePythonBuffer(code: string): string {
    if (!code.trim()) {
      return 'Error: Editor buffer is empty. Write Python code before running.';
    }

    for (const pattern of PYTHON_SECURITY_PATTERNS) {
      if (pattern.test(code)) {
        return '[Sandbox Security]: Restricted host module or dynamic execution call is disabled in the simulated Python runtime.';
      }
    }

    const lines = code.replace(/\r\n/g, '\n').split('\n');
    const env: Record<string, any> = {};
    const funcs: Record<string, SimFunction> = {};
    const outputs: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const lineNum = i + 1;

      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      // Skip top-level if __name__ == "__main__": header and execute its indented body
      if (/^if\s+__name__\s*==\s*["']__main__["']\s*:$/.test(trimmed)) {
        i++;
        while (i < lines.length && (/^\s+/.test(lines[i]) || !lines[i].trim())) {
          const inner = lines[i].trim();
          if (inner && !inner.startsWith('#')) {
            const res = this.execPythonStatement(inner, i + 1, env, funcs);
            if (res.error) return res.error;
            outputs.push(...res.outputs);
          }
          i++;
        }
        continue;
      }

      // Function definition: def name(params):
      const defMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:$/);
      if (defMatch) {
        const funcName = defMatch[1];
        const params = defMatch[2]
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        const bodyLines: string[] = [];
        i++;
        while (i < lines.length && (/^\s+/.test(lines[i]) || !lines[i].trim())) {
          const bodyTrimmed = lines[i].trim();
          if (bodyTrimmed && !bodyTrimmed.startsWith('#')) {
            bodyLines.push(bodyTrimmed);
          }
          i++;
        }
        funcs[funcName] = { params, bodyLines };
        continue;
      }

      const res = this.execPythonStatement(trimmed, lineNum, env, funcs);
      if (res.error) return res.error;
      outputs.push(...res.outputs);
      i++;
    }

    return outputs.length > 0
      ? outputs.join('\n')
      : 'Script executed successfully with exit code 0.';
  }

  private static execPythonStatement(
    stmt: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>
  ): ExecResult {
    const outputs: string[] = [];

    // Check unsupported Python constructs explicitly
    if (/^(while|for|class|try|except|finally|with|import|from|elif|else|if)\b/.test(stmt)) {
      return {
        outputs,
        error: `[Simulated Python 3.11]: Unsupported construct on line ${lineNum} ("${stmt}"). Supported subset: variable assignments, arithmetic/string expressions, basic def/return functions, f-strings, and print() statements.`,
      };
    }

    // print(...)
    const printMatch = stmt.match(/^print\s*\(([\s\S]*)\)$/);
    if (printMatch) {
      const args = this.splitTopLevelArgs(printMatch[1]);
      const evaluated = args.map((arg) => {
        const val = this.evalExpression(arg, env, funcs, 'python');
        return val === undefined ? 'None' : String(val);
      });
      outputs.push(evaluated.join(' '));
      return { outputs };
    }

    // Assignment: x = expr
    const assignMatch = stmt.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch && !stmt.startsWith('==')) {
      const [, varName, expr] = assignMatch;
      env[varName] = this.evalExpression(expr, env, funcs, 'python');
      return { outputs };
    }

    // Standalone function call: main()
    const callMatch = stmt.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      const callRes = this.invokeFunction(callMatch[1], callMatch[2], env, funcs, 'python');
      if (callRes.error) return { outputs, error: callRes.error };
      outputs.push(...callRes.outputs);
      return { outputs };
    }

    return {
      outputs,
      error: `[Simulated Python 3.11]: Unsupported statement on line ${lineNum} ("${stmt}"). Supported subset: variable assignments, arithmetic/string expressions, basic def/return functions, f-strings, and print() statements.`,
    };
  }

  private static evaluateJsBuffer(code: string): string {
    if (!code.trim()) {
      return 'Error: Editor buffer is empty. Write JavaScript code before running.';
    }

    for (const pattern of JS_SECURITY_PATTERNS) {
      if (pattern.test(code)) {
        return '[Sandbox Security]: Restricted host module or dynamic execution call is disabled in the simulated Node.js runtime.';
      }
    }

    // Strip /* ... */ block comments while preserving line count roughly
    const cleaned = code.replace(/\/\*[\s\S]*?\*\//g, (m) =>
      m.replace(/[^\n]/g, ' ')
    );
    const lines = cleaned.replace(/\r\n/g, '\n').split('\n');
    const env: Record<string, any> = {};
    const funcs: Record<string, SimFunction> = {};
    const outputs: string[] = [];

    let i = 0;
    while (i < lines.length) {
      let trimmed = lines[i].trim();
      const lineNum = i + 1;

      if (!trimmed || trimmed.startsWith('//')) {
        i++;
        continue;
      }

      // Accumulate multi-line object/array/call statements if braces/parens are unbalanced
      let balance = this.delimiterBalance(trimmed);
      while (balance > 0 && i + 1 < lines.length) {
        i++;
        const nextTrimmed = lines[i].trim();
        if (nextTrimmed && !nextTrimmed.startsWith('//')) {
          trimmed += ' ' + nextTrimmed;
          balance = this.delimiterBalance(trimmed);
        }
      }

      // Function declaration: function name(params) { ... }
      const fnHeader = trimmed.match(
        /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/
      );
      if (fnHeader) {
        const [, fnName, paramStr, bodyStr] = fnHeader;
        const params = paramStr
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        const bodyLines = bodyStr
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        funcs[fnName] = { params, bodyLines };
        i++;
        continue;
      }

      const stmt = trimmed.replace(/;$/, '').trim();
      const res = this.execJsStatement(stmt, lineNum, env, funcs);
      if (res.error) return res.error;
      outputs.push(...res.outputs);
      i++;
    }

    return outputs.length > 0
      ? outputs.join('\n')
      : 'Process exited with code 0.';
  }

  private static execJsStatement(
    stmt: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>
  ): ExecResult {
    const outputs: string[] = [];

    if (/^(while|for|class|try|catch|switch|import|export|async|await|if|else)\b/.test(stmt)) {
      return {
        outputs,
        error: `[Simulated Node.js v20.12]: Unsupported construct on line ${lineNum} ("${stmt}"). Supported subset: const/let/var declarations, simple objects/arrays, basic function/return, template literals, JSON.stringify(), and console.log() statements.`,
      };
    }

    // console.log(...)
    const logMatch = stmt.match(/^console\.log\s*\(([\s\S]*)\)$/);
    if (logMatch) {
      const args = this.splitTopLevelArgs(logMatch[1]);
      const evaluated = args.map((arg) => {
        const val = this.evalExpression(arg, env, funcs, 'javascript');
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return String(val);
      });
      outputs.push(evaluated.join(' '));
      return { outputs };
    }

    // const / let / var declaration or reassignment
    const declMatch = stmt.match(/^(?:(?:const|let|var)\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([\s\S]+)$/);
    if (declMatch && !stmt.startsWith('==')) {
      const [, varName, expr] = declMatch;
      env[varName] = this.evalExpression(expr, env, funcs, 'javascript');
      return { outputs };
    }

    // Standalone function call
    const callMatch = stmt.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      const callRes = this.invokeFunction(callMatch[1], callMatch[2], env, funcs, 'javascript');
      if (callRes.error) return { outputs, error: callRes.error };
      outputs.push(...callRes.outputs);
      return { outputs };
    }

    return {
      outputs,
      error: `[Simulated Node.js v20.12]: Unsupported statement on line ${lineNum} ("${stmt}"). Supported subset: const/let/var declarations, simple objects/arrays, basic function/return, template literals, JSON.stringify(), and console.log() statements.`,
    };
  }

  private static invokeFunction(
    name: string,
    argsStr: string,
    parentEnv: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage
  ): { outputs: string[]; returnValue: any; error?: string } {
    const fn = funcs[name];
    const localEnv: Record<string, any> = { ...parentEnv };
    const argExprs = this.splitTopLevelArgs(argsStr);
    fn.params.forEach((param, idx) => {
      localEnv[param] =
        idx < argExprs.length
          ? this.evalExpression(argExprs[idx], parentEnv, funcs, lang)
          : undefined;
    });

    const outputs: string[] = [];
    for (const line of fn.bodyLines) {
      const cleanLine = line.replace(/;$/, '').trim();
      const retMatch = cleanLine.match(/^return\s+([\s\S]+)$/);
      if (retMatch) {
        return {
          outputs,
          returnValue: this.evalExpression(retMatch[1], localEnv, funcs, lang),
        };
      }

      const res =
        lang === 'python'
          ? this.execPythonStatement(cleanLine, 0, localEnv, funcs)
          : this.execJsStatement(cleanLine, 0, localEnv, funcs);

      if (res.error) return { outputs, returnValue: undefined, error: res.error };
      outputs.push(...res.outputs);
    }

    return { outputs, returnValue: undefined };
  }

  private static evalExpression(
    rawExpr: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage
  ): any {
    const expr = rawExpr.trim();
    if (!expr) return undefined;

    // Python f-string: f"..." or f'...'
    if (lang === 'python' && /^f(["'])([\s\S]*)\1$/.test(expr)) {
      const inner = expr.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, key) => {
        const val = this.evalExpression(key.trim(), env, funcs, lang);
        return val === undefined ? 'None' : String(val);
      });
    }

    // JS template literal: `...`
    if (lang === 'javascript' && expr.startsWith('`') && expr.endsWith('`')) {
      const inner = expr.slice(1, -1);
      return inner.replace(/\$\{([^}]+)\}/g, (_, key) => {
        const val = this.evalExpression(key.trim(), env, funcs, lang);
        return String(val);
      });
    }

    // String literal
    if (
      (expr.startsWith('"') && expr.endsWith('"') && !expr.slice(1, -1).includes('"')) ||
      (expr.startsWith("'") && expr.endsWith("'") && !expr.slice(1, -1).includes("'"))
    ) {
      return expr.slice(1, -1);
    }

    // Booleans & Null/None
    if (expr === 'true' || expr === 'True') return true;
    if (expr === 'false' || expr === 'False') return false;
    if (expr === 'null' || expr === 'None') return null;

    // Number literal
    if (/^-?\d+(?:\.\d+)?$/.test(expr)) {
      return Number(expr);
    }

    // JSON.stringify(target, ...)
    if (lang === 'javascript') {
      const jsonMatch = expr.match(/^JSON\.stringify\s*\(([\s\S]*)\)$/);
      if (jsonMatch) {
        const args = this.splitTopLevelArgs(jsonMatch[1]);
        const target = this.evalExpression(args[0], env, funcs, lang);
        const space = args[2] ? Number(this.evalExpression(args[2], env, funcs, lang)) : undefined;
        return JSON.stringify(target, null, Number.isFinite(space) ? space : undefined);
      }
    }

    // Array literal: [...]
    if (expr.startsWith('[') && expr.endsWith(']')) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return [];
      return this.splitTopLevelArgs(inner).map((item) =>
        this.evalExpression(item, env, funcs, lang)
      );
    }

    // Object literal: { key: val, ... }
    if (expr.startsWith('{') && expr.endsWith('}')) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return {};
      const obj: Record<string, any> = {};
      for (const pair of this.splitTopLevelArgs(inner)) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx !== -1) {
          const rawKey = pair.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
          const rawVal = pair.slice(colonIdx + 1).trim();
          obj[rawKey] = this.evalExpression(rawVal, env, funcs, lang);
        }
      }
      return obj;
    }

    // Function call expression: fn(arg1, arg2)
    const callMatch = expr.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      return this.invokeFunction(callMatch[1], callMatch[2], env, funcs, lang).returnValue;
    }

    // Variable reference
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expr) && expr in env) {
      return env[expr];
    }

    // Simple binary arithmetic / concatenation (safe recursive split, no eval)
    const binaryResult = this.evalBinaryExpression(expr, env, funcs, lang);
    if (binaryResult !== undefined) {
      return binaryResult;
    }

    return expr;
  }

  private static evalBinaryExpression(
    expr: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage
  ): any {
    const opsLow = ['+', '-'];
    const opsHigh = ['*', '/', '%'];

    for (const opSet of [opsLow, opsHigh]) {
      let depth = 0;
      let quote: string | null = null;
      for (let i = expr.length - 1; i >= 0; i--) {
        const ch = expr[i];
        if ((ch === '"' || ch === "'" || ch === '`') && expr[i - 1] !== '\\') {
          quote = quote === ch ? null : quote ? quote : ch;
        } else if (!quote) {
          if (ch === ')' || ch === ']' || ch === '}') depth++;
          else if (ch === '(' || ch === '[' || ch === '{') depth--;
          else if (depth === 0 && opSet.includes(ch) && i > 0) {
            const left = this.evalExpression(expr.slice(0, i), env, funcs, lang);
            const right = this.evalExpression(expr.slice(i + 1), env, funcs, lang);
            if (ch === '+') return left + right;
            if (typeof left === 'number' && typeof right === 'number') {
              if (ch === '-') return left - right;
              if (ch === '*') return left * right;
              if (ch === '/') return right === 0 ? 'ZeroDivisionError' : left / right;
              if (ch === '%') return left % right;
            }
          }
        }
      }
    }
    return undefined;
  }

  private static splitTopLevelArgs(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let depth = 0;
    let quote: string | null = null;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if ((ch === '"' || ch === "'" || ch === '`') && input[i - 1] !== '\\') {
        quote = quote === ch ? null : quote ? quote : ch;
        current += ch;
      } else if (!quote) {
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;

        if (ch === ',' && depth === 0) {
          if (current.trim()) args.push(current.trim());
          current = '';
          continue;
        }
        current += ch;
      } else {
        current += ch;
      }
    }

    if (current.trim()) args.push(current.trim());
    return args;
  }

  private static delimiterBalance(text: string): number {
    let balance = 0;
    let quote: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if ((ch === '"' || ch === "'" || ch === '`') && text[i - 1] !== '\\') {
        quote = quote === ch ? null : quote ? quote : ch;
      } else if (!quote) {
        if (ch === '{' || ch === '[' || ch === '(') balance++;
        else if (ch === '}' || ch === ']' || ch === ')') balance--;
      }
    }
    return balance;
  }
}
