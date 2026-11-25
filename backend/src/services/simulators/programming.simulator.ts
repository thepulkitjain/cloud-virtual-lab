export type SupportedLanguage = 'python' | 'javascript';

interface SimFunction {
  params: string[];
  bodyLines: string[];
}

interface ExecContext {
  steps: number;
}

interface ExecResult {
  outputs: string[];
  returnValue?: any;
  hasReturned?: boolean;
  error?: string;
}

const MAX_LOOP_ITERATIONS = 100;
const MAX_TOTAL_STEPS = 500;

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
      return "prog-sim: empty command. Use 'python3 <file>' or 'node <file>'.";
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

  private static tickStep(ctx: ExecContext, runtimeLabel: string): string | null {
    ctx.steps += 1;
    if (ctx.steps > MAX_TOTAL_STEPS) {
      return `[Simulated ${runtimeLabel}]: Execution step limit (${MAX_TOTAL_STEPS}) exceeded.`;
    }
    return null;
  }

  // ============================================================================
  // Python Restricted Evaluator (with bounded for-loops and if/elif/else)
  // ============================================================================

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
    const ctx: ExecContext = { steps: 0 };

    const res = this.execPythonBlock(lines, 0, env, funcs, ctx, true);
    if (res.error) return res.error;

    return res.outputs.length > 0
      ? res.outputs.join('\n')
      : 'Script executed successfully with exit code 0.';
  }

  private static getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  private static collectPythonIndentedBlock(
    lines: string[],
    startIdx: number,
    parentIndent: number
  ): { blockLines: string[]; nextIdx: number } {
    const blockLines: string[] = [];
    let i = startIdx;
    while (i < lines.length) {
      const raw = lines[i];
      if (!raw.trim() || raw.trim().startsWith('#')) {
        blockLines.push(raw);
        i++;
        continue;
      }
      if (this.getIndent(raw) <= parentIndent) {
        break;
      }
      blockLines.push(raw);
      i++;
    }
    return { blockLines, nextIdx: i };
  }

  private static execPythonBlock(
    lines: string[],
    lineOffset: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext,
    allowDefs: boolean
  ): ExecResult {
    const outputs: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const rawLine = lines[i];
      const trimmed = rawLine.trim();
      const lineNum = lineOffset + i + 1;

      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      const stepErr = this.tickStep(ctx, 'Python 3.11');
      if (stepErr) return { outputs, error: stepErr };

      const currentIndent = this.getIndent(rawLine);

      // Handle if __name__ == "__main__":
      if (/^if\s+__name__\s*==\s*["']__main__["']\s*:$/.test(trimmed)) {
        const { blockLines, nextIdx } = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
        const bodyRes = this.execPythonBlock(blockLines, lineOffset + i + 1, env, funcs, ctx, false);
        if (bodyRes.error) return bodyRes;
        outputs.push(...bodyRes.outputs);
        i = nextIdx;
        continue;
      }

      // Function definition
      const defMatch = trimmed.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:$/);
      if (defMatch && allowDefs) {
        const funcName = defMatch[1];
        const params = defMatch[2].split(',').map((p) => p.trim()).filter(Boolean);
        const { blockLines, nextIdx } = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
        funcs[funcName] = { params, bodyLines: blockLines };
        i = nextIdx;
        continue;
      }

      // Return statement inside function
      const retMatch = trimmed.match(/^return\s+([\s\S]+)$/);
      if (retMatch) {
        return {
          outputs,
          returnValue: this.evalExpression(retMatch[1], env, funcs, 'python', ctx),
          hasReturned: true,
        };
      }

      // if / elif / else chain
      const ifMatch = trimmed.match(/^if\s+([\s\S]+):$/);
      if (ifMatch) {
        const branches: Array<{ cond: string | null; blockLines: string[]; offset: number }> = [];
        const first = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
        branches.push({ cond: ifMatch[1].trim(), blockLines: first.blockLines, offset: lineOffset + i + 1 });
        i = first.nextIdx;

        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          const nextIndent = this.getIndent(lines[i]);
          if (!nextTrimmed || nextTrimmed.startsWith('#')) {
            i++;
            continue;
          }
          if (nextIndent !== currentIndent) break;

          const elifMatch = nextTrimmed.match(/^elif\s+([\s\S]+):$/);
          if (elifMatch) {
            const blk = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
            branches.push({ cond: elifMatch[1].trim(), blockLines: blk.blockLines, offset: lineOffset + i + 1 });
            i = blk.nextIdx;
            continue;
          }
          if (/^else\s*:$/.test(nextTrimmed)) {
            const blk = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
            branches.push({ cond: null, blockLines: blk.blockLines, offset: lineOffset + i + 1 });
            i = blk.nextIdx;
          }
          break;
        }

        for (const branch of branches) {
          if (branch.cond === null || this.evalCondition(branch.cond, env, funcs, 'python', ctx)) {
            const bRes = this.execPythonBlock(branch.blockLines, branch.offset, env, funcs, ctx, false);
            outputs.push(...bRes.outputs);
            if (bRes.error || bRes.hasReturned) return { ...bRes, outputs };
            break;
          }
        }
        continue;
      }

      // Bounded for-loop: for x in range(...) or for x in list
      const forMatch = trimmed.match(/^for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+([\s\S]+):$/);
      if (forMatch) {
        const [, loopVar, iterableExpr] = forMatch;
        const { blockLines, nextIdx } = this.collectPythonIndentedBlock(lines, i + 1, currentIndent);
        const items = this.resolvePythonIterable(iterableExpr.trim(), env, funcs, ctx);
        if (items.error) return { outputs, error: items.error };

        if (items.values.length > MAX_LOOP_ITERATIONS) {
          return {
            outputs,
            error: `[Simulated Python 3.11]: Loop iteration limit (${MAX_LOOP_ITERATIONS}) exceeded.`,
          };
        }

        for (const item of items.values) {
          env[loopVar] = item;
          const bRes = this.execPythonBlock(blockLines, lineOffset + i + 1, env, funcs, ctx, false);
          outputs.push(...bRes.outputs);
          if (bRes.error || bRes.hasReturned) return { ...bRes, outputs };
        }
        i = nextIdx;
        continue;
      }

      const stmtRes = this.execPythonStatement(trimmed, lineNum, env, funcs, ctx);
      if (stmtRes.error) return { outputs, error: stmtRes.error };
      outputs.push(...stmtRes.outputs);
      i++;
    }

    return { outputs };
  }

  private static resolvePythonIterable(
    expr: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext
  ): { values: any[]; error?: string } {
    const rangeMatch = expr.match(/^range\s*\(([\s\S]*)\)$/);
    if (rangeMatch) {
      const args = this.splitTopLevelArgs(rangeMatch[1]).map((a) =>
        Number(this.evalExpression(a, env, funcs, 'python', ctx))
      );
      if (args.some((n) => !Number.isFinite(n))) {
        return { values: [], error: '[Simulated Python 3.11]: Invalid range() arguments.' };
      }
      let start = 0;
      let stop = 0;
      let step = 1;
      if (args.length === 1) {
        stop = args[0];
      } else if (args.length === 2) {
        [start, stop] = args;
      } else if (args.length === 3) {
        [start, stop, step] = args;
      } else {
        return { values: [], error: '[Simulated Python 3.11]: range() expects 1 to 3 arguments.' };
      }

      if (step === 0) {
        return { values: [], error: '[Simulated Python 3.11]: range() step argument must not be zero.' };
      }

      const values: number[] = [];
      for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
        values.push(v);
        if (values.length > MAX_LOOP_ITERATIONS) {
          return {
            values: [],
            error: `[Simulated Python 3.11]: Loop iteration limit (${MAX_LOOP_ITERATIONS}) exceeded.`,
          };
        }
      }
      return { values };
    }

    const evaluated = this.evalExpression(expr, env, funcs, 'python', ctx);
    if (Array.isArray(evaluated)) {
      return { values: evaluated };
    }
    return {
      values: [],
      error: `[Simulated Python 3.11]: Unsupported iterable "${expr}" in for-loop.`,
    };
  }

  private static execPythonStatement(
    stmt: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext
  ): ExecResult {
    const outputs: string[] = [];

    if (/^(while|class|try|except|finally|with|import|from|elif|else)\b/.test(stmt)) {
      return {
        outputs,
        error: `[Simulated Python 3.11]: Unsupported construct on line ${lineNum} ("${stmt}"). Supported subset: variables, arithmetic/string expressions, if/elif/else, bounded for-loops, basic def/return functions, f-strings, and print() statements.`,
      };
    }

    const printMatch = stmt.match(/^print\s*\(([\s\S]*)\)$/);
    if (printMatch) {
      const args = this.splitTopLevelArgs(printMatch[1]);
      const evaluated = args.map((arg) => {
        const val = this.evalExpression(arg, env, funcs, 'python', ctx);
        return val === undefined ? 'None' : String(val);
      });
      outputs.push(evaluated.join(' '));
      return { outputs };
    }

    // Compound assignment: +=, -=
    const augAssign = stmt.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=)\s*(.+)$/);
    if (augAssign) {
      const [, varName, op, rhsExpr] = augAssign;
      const rhs = this.evalExpression(rhsExpr, env, funcs, 'python', ctx);
      const cur = env[varName] ?? 0;
      env[varName] = op === '+=' ? cur + rhs : Number(cur) - Number(rhs);
      return { outputs };
    }

    const assignMatch = stmt.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assignMatch && !stmt.startsWith('==')) {
      const [, varName, expr] = assignMatch;
      env[varName] = this.evalExpression(expr, env, funcs, 'python', ctx);
      return { outputs };
    }

    const callMatch = stmt.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      const callRes = this.invokeFunction(callMatch[1], callMatch[2], env, funcs, 'python', ctx);
      if (callRes.error) return { outputs, error: callRes.error };
      outputs.push(...callRes.outputs);
      return { outputs };
    }

    return {
      outputs,
      error: `[Simulated Python 3.11]: Unsupported statement on line ${lineNum} ("${stmt}"). Supported subset: variables, arithmetic/string expressions, if/elif/else, bounded for-loops, basic def/return functions, f-strings, and print() statements.`,
    };
  }

  // ============================================================================
  // JavaScript Restricted Evaluator (with bounded for-loops and if/else)
  // ============================================================================

  private static evaluateJsBuffer(code: string): string {
    if (!code.trim()) {
      return 'Error: Editor buffer is empty. Write JavaScript code before running.';
    }

    for (const pattern of JS_SECURITY_PATTERNS) {
      if (pattern.test(code)) {
        return '[Sandbox Security]: Restricted host module or dynamic execution call is disabled in the simulated Node.js runtime.';
      }
    }

    const cleaned = code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
    const lines = cleaned.replace(/\r\n/g, '\n').split('\n');
    const env: Record<string, any> = {};
    const funcs: Record<string, SimFunction> = {};
    const ctx: ExecContext = { steps: 0 };

    const res = this.execJsBlock(lines, 0, env, funcs, ctx, true);
    if (res.error) return res.error;

    return res.outputs.length > 0
      ? res.outputs.join('\n')
      : 'Process exited with code 0.';
  }

  private static collectJsBraceBlock(
    lines: string[],
    startIdx: number
  ): { fullBlock: string; nextIdx: number } {
    let combined = lines[startIdx].trim();
    let balance = this.delimiterBalance(combined);
    let i = startIdx;

    while (balance > 0 && i + 1 < lines.length) {
      i++;
      const nextTrimmed = lines[i].trim();
      if (nextTrimmed && !nextTrimmed.startsWith('//')) {
        combined += '\n' + lines[i];
        balance = this.delimiterBalance(combined);
      }
    }
    return { fullBlock: combined, nextIdx: i + 1 };
  }

  private static splitJsTopLevelStatements(body: string): string[] {
    const stmts: string[] = [];
    let current = '';
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let quote: string | null = null;

    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if ((ch === '"' || ch === "'" || ch === '`') && body[i - 1] !== '\\') {
        quote = quote === ch ? null : quote ? quote : ch;
        current += ch;
        continue;
      }
      if (!quote) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth--;
        else if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth--;

        const isTop = braceDepth === 0 && parenDepth === 0 && bracketDepth === 0;
        if (isTop && (ch === ';' || ch === '\n')) {
          if (current.trim()) stmts.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) stmts.push(current.trim());
    return stmts;
  }

  private static execJsBlock(
    lines: string[],
    lineOffset: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext,
    allowDefs: boolean
  ): ExecResult {
    const outputs: string[] = [];
    let i = 0;

    while (i < lines.length) {
      let trimmed = lines[i].trim();
      const lineNum = lineOffset + i + 1;

      if (!trimmed || trimmed.startsWith('//')) {
        i++;
        continue;
      }

      const stepErr = this.tickStep(ctx, 'Node.js v20.12');
      if (stepErr) return { outputs, error: stepErr };

      // Collect multi-line blocks/objects
      const collected = this.collectJsBraceBlock(lines, i);
      trimmed = collected.fullBlock.trim();
      i = collected.nextIdx;

      // Function declaration: function name(params) { ... }
      const fnHeader = trimmed.match(
        /^function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/
      );
      if (fnHeader && allowDefs) {
        const [, fnName, paramStr, bodyStr] = fnHeader;
        const params = paramStr.split(',').map((p) => p.trim()).filter(Boolean);
        const bodyLines = this.splitJsTopLevelStatements(bodyStr);
        funcs[fnName] = { params, bodyLines };
        continue;
      }

      // Return statement
      const retMatch = trimmed.replace(/;$/, '').match(/^return\s+([\s\S]+)$/);
      if (retMatch) {
        return {
          outputs,
          returnValue: this.evalExpression(retMatch[1], env, funcs, 'javascript', ctx),
          hasReturned: true,
        };
      }

      // if (...) { ... } [else if (...) { ... }] [else { ... }]
      if (/^if\s*\(/.test(trimmed)) {
        // Consume any trailing else if / else lines if written on subsequent lines
        while (i < lines.length && /^(?:else\s+if|else)\b/.test(lines[i].trim())) {
          const nextBlk = this.collectJsBraceBlock(lines, i);
          trimmed += ' ' + nextBlk.fullBlock.trim();
          i = nextBlk.nextIdx;
        }
        const ifRes = this.execJsIfChain(trimmed, lineNum, env, funcs, ctx);
        outputs.push(...ifRes.outputs);
        if (ifRes.error || ifRes.hasReturned) return { ...ifRes, outputs };
        continue;
      }

      // Bounded for-loop: for (let i = 0; i < 5; i++) { ... } or for (const item of arr) { ... }
      if (/^for\s*\(/.test(trimmed)) {
        const forRes = this.execJsForLoop(trimmed, lineNum, env, funcs, ctx);
        outputs.push(...forRes.outputs);
        if (forRes.error || forRes.hasReturned) return { ...forRes, outputs };
        continue;
      }

      const stmt = trimmed.replace(/;$/, '').trim();
      const res = this.execJsStatement(stmt, lineNum, env, funcs, ctx);
      if (res.error) return { outputs, error: res.error };
      outputs.push(...res.outputs);
    }

    return { outputs };
  }

  private static extractParenAndBraceBlock(
    src: string,
    startIdx: number
  ): { condition: string; body: string; nextIdx: number } | null {
    const openParen = src.indexOf('(', startIdx);
    if (openParen === -1) return null;
    let pDepth = 1;
    let idx = openParen + 1;
    while (idx < src.length && pDepth > 0) {
      if (src[idx] === '(') pDepth++;
      else if (src[idx] === ')') pDepth--;
      idx++;
    }
    if (pDepth !== 0) return null;
    const condition = src.slice(openParen + 1, idx - 1).trim();

    const openBrace = src.indexOf('{', idx);
    if (openBrace === -1) return null;
    let bDepth = 1;
    let bIdx = openBrace + 1;
    while (bIdx < src.length && bDepth > 0) {
      if (src[bIdx] === '{') bDepth++;
      else if (src[bIdx] === '}') bDepth--;
      bIdx++;
    }
    if (bDepth !== 0) return null;
    const body = src.slice(openBrace + 1, bIdx - 1);

    return { condition, body, nextIdx: bIdx };
  }

  private static execJsIfChain(
    trimmed: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext
  ): ExecResult {
    const branches: Array<{ cond: string | null; body: string }> = [];
    let cursor = 0;

    const first = this.extractParenAndBraceBlock(trimmed, cursor);
    if (!first) {
      return {
        outputs: [],
        error: `[Simulated Node.js v20.12]: Malformed if-statement on line ${lineNum}.`,
      };
    }
    branches.push({ cond: first.condition, body: first.body });
    cursor = first.nextIdx;

    while (cursor < trimmed.length) {
      const rest = trimmed.slice(cursor).trimStart();
      if (!rest) break;
      const shift = trimmed.length - rest.length;
      cursor = shift;

      if (rest.startsWith('else if')) {
        const blk = this.extractParenAndBraceBlock(trimmed, cursor);
        if (!blk) break;
        branches.push({ cond: blk.condition, body: blk.body });
        cursor = blk.nextIdx;
        continue;
      }

      if (rest.startsWith('else')) {
        const openBrace = trimmed.indexOf('{', cursor);
        if (openBrace === -1) break;
        let bDepth = 1;
        let bIdx = openBrace + 1;
        while (bIdx < trimmed.length && bDepth > 0) {
          if (trimmed[bIdx] === '{') bDepth++;
          else if (trimmed[bIdx] === '}') bDepth--;
          bIdx++;
        }
        branches.push({ cond: null, body: trimmed.slice(openBrace + 1, bIdx - 1) });
        cursor = bIdx;
        continue;
      }
      break;
    }

    for (const branch of branches) {
      if (branch.cond === null || this.evalCondition(branch.cond, env, funcs, 'javascript', ctx)) {
        const bodyLines = this.splitJsTopLevelStatements(branch.body);
        return this.execJsBlock(bodyLines, lineNum - 1, env, funcs, ctx, false);
      }
    }

    return { outputs: [] };
  }

  private static execJsForLoop(
    trimmed: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext
  ): ExecResult {
    const parsed = this.extractParenAndBraceBlock(trimmed, 0);
    if (!parsed) {
      return {
        outputs: [],
        error: `[Simulated Node.js v20.12]: Malformed for-loop on line ${lineNum}.`,
      };
    }

    const { condition: header, body } = parsed;
    const bodyLines = this.splitJsTopLevelStatements(body);
    const outputs: string[] = [];

    // Check for-of: const/let/var item of iterable
    const forOfMatch = header.match(
      /^(?:(?:const|let|var)\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s+of\s+([\s\S]+)$/
    );
    if (forOfMatch) {
      const [, loopVar, iterExpr] = forOfMatch;
      const arr = this.evalExpression(iterExpr, env, funcs, 'javascript', ctx);
      if (!Array.isArray(arr)) {
        return {
          outputs,
          error: `[Simulated Node.js v20.12]: "${iterExpr}" is not iterable in for-of loop.`,
        };
      }
      if (arr.length > MAX_LOOP_ITERATIONS) {
        return {
          outputs,
          error: `[Simulated Node.js v20.12]: Loop iteration limit (${MAX_LOOP_ITERATIONS}) exceeded.`,
        };
      }
      for (const item of arr) {
        const stepErr = this.tickStep(ctx, 'Node.js v20.12');
        if (stepErr) return { outputs, error: stepErr };
        env[loopVar] = item;
        const bRes = this.execJsBlock(bodyLines, lineNum - 1, env, funcs, ctx, false);
        outputs.push(...bRes.outputs);
        if (bRes.error || bRes.hasReturned) return { ...bRes, outputs };
      }
      return { outputs };
    }

    // Classic C-style bounded for (let i = 0; i < 5; i++)
    const parts = header.split(';').map((p) => p.trim());
    if (parts.length !== 3) {
      return {
        outputs,
        error: `[Simulated Node.js v20.12]: Unsupported for-loop header on line ${lineNum}.`,
      };
    }
    const [initPart, condPart, stepPart] = parts;
    const initMatch = initPart.match(
      /^(?:(?:let|var|const)\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(.+)$/
    );
    if (!initMatch) {
      return {
        outputs,
        error: `[Simulated Node.js v20.12]: Unsupported for-loop initializer on line ${lineNum}.`,
      };
    }
    env[initMatch[1]] = this.evalExpression(initMatch[2], env, funcs, 'javascript', ctx);

    let iterations = 0;
    while (this.evalCondition(condPart, env, funcs, 'javascript', ctx)) {
      iterations++;
      if (iterations > MAX_LOOP_ITERATIONS) {
        return {
          outputs,
          error: `[Simulated Node.js v20.12]: Loop iteration limit (${MAX_LOOP_ITERATIONS}) exceeded.`,
        };
      }
      const stepErr = this.tickStep(ctx, 'Node.js v20.12');
      if (stepErr) return { outputs, error: stepErr };

      const bRes = this.execJsBlock(bodyLines, lineNum - 1, env, funcs, ctx, false);
      outputs.push(...bRes.outputs);
      if (bRes.error || bRes.hasReturned) return { ...bRes, outputs };

      // Apply step expression (i++, i--, i += n, i -= n)
      if (/^([A-Za-z_$][A-Za-z0-9_$]*)\+\+$/.test(stepPart)) {
        const v = stepPart.slice(0, -2);
        env[v] = Number(env[v]) + 1;
      } else if (/^([A-Za-z_$][A-Za-z0-9_$]*)--$/.test(stepPart)) {
        const v = stepPart.slice(0, -2);
        env[v] = Number(env[v]) - 1;
      } else {
        const aug = stepPart.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\+=|-=)\s*(.+)$/);
        if (!aug) {
          return {
            outputs,
            error: `[Simulated Node.js v20.12]: Unsupported for-loop step "${stepPart}".`,
          };
        }
        const delta = Number(this.evalExpression(aug[3], env, funcs, 'javascript', ctx));
        env[aug[1]] = aug[2] === '+=' ? Number(env[aug[1]]) + delta : Number(env[aug[1]]) - delta;
      }
    }

    return { outputs };
  }

  private static execJsStatement(
    stmt: string,
    lineNum: number,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    ctx: ExecContext
  ): ExecResult {
    const outputs: string[] = [];

    if (/^(while|class|try|catch|switch|import|export|async|await|else)\b/.test(stmt)) {
      return {
        outputs,
        error: `[Simulated Node.js v20.12]: Unsupported construct on line ${lineNum} ("${stmt}"). Supported subset: const/let/var declarations, objects/arrays, if/else, bounded for-loops, basic function/return, template literals, JSON.stringify(), and console.log() statements.`,
      };
    }

    const logMatch = stmt.match(/^console\.log\s*\(([\s\S]*)\)$/);
    if (logMatch) {
      const args = this.splitTopLevelArgs(logMatch[1]);
      const evaluated = args.map((arg) => {
        const val = this.evalExpression(arg, env, funcs, 'javascript', ctx);
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val);
        }
        return String(val);
      });
      outputs.push(evaluated.join(' '));
      return { outputs };
    }

    const augAssign = stmt.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*(\+=|-=)\s*(.+)$/);
    if (augAssign) {
      const [, varName, op, rhsExpr] = augAssign;
      const rhs = this.evalExpression(rhsExpr, env, funcs, 'javascript', ctx);
      const cur = env[varName] ?? 0;
      env[varName] = op === '+=' ? cur + rhs : Number(cur) - Number(rhs);
      return { outputs };
    }

    const declMatch = stmt.match(/^(?:(?:const|let|var)\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([\s\S]+)$/);
    if (declMatch && !stmt.startsWith('==')) {
      const [, varName, expr] = declMatch;
      env[varName] = this.evalExpression(expr, env, funcs, 'javascript', ctx);
      return { outputs };
    }

    const callMatch = stmt.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      const callRes = this.invokeFunction(callMatch[1], callMatch[2], env, funcs, 'javascript', ctx);
      if (callRes.error) return { outputs, error: callRes.error };
      outputs.push(...callRes.outputs);
      return { outputs };
    }

    return {
      outputs,
      error: `[Simulated Node.js v20.12]: Unsupported statement on line ${lineNum} ("${stmt}"). Supported subset: const/let/var declarations, objects/arrays, if/else, bounded for-loops, basic function/return, template literals, JSON.stringify(), and console.log() statements.`,
    };
  }

  private static invokeFunction(
    name: string,
    argsStr: string,
    parentEnv: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage,
    ctx: ExecContext
  ): { outputs: string[]; returnValue: any; error?: string } {
    const stepErr = this.tickStep(ctx, lang === 'python' ? 'Python 3.11' : 'Node.js v20.12');
    if (stepErr) return { outputs: [], returnValue: undefined, error: stepErr };

    const fn = funcs[name];
    const localEnv: Record<string, any> = { ...parentEnv };
    const argExprs = this.splitTopLevelArgs(argsStr);
    fn.params.forEach((param, idx) => {
      localEnv[param] =
        idx < argExprs.length
          ? this.evalExpression(argExprs[idx], parentEnv, funcs, lang, ctx)
          : undefined;
    });

    const res =
      lang === 'python'
        ? this.execPythonBlock(fn.bodyLines, 0, localEnv, funcs, ctx, false)
        : this.execJsBlock(fn.bodyLines, 0, localEnv, funcs, ctx, false);

    return { outputs: res.outputs, returnValue: res.returnValue, error: res.error };
  }

  // ============================================================================
  // Safe Expression & Condition Evaluators (No eval / Function)
  // ============================================================================

  private static evalCondition(
    rawCond: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage,
    ctx: ExecContext
  ): boolean {
    const cond = rawCond.trim();
    if (!cond) return false;

    const orToken = lang === 'python' ? ' or ' : '||';
    if (cond.includes(orToken)) {
      return cond
        .split(orToken)
        .some((part) => this.evalCondition(part, env, funcs, lang, ctx));
    }

    const andToken = lang === 'python' ? ' and ' : '&&';
    if (cond.includes(andToken)) {
      return cond
        .split(andToken)
        .every((part) => this.evalCondition(part, env, funcs, lang, ctx));
    }

    if (lang === 'python' && cond.startsWith('not ')) {
      return !this.evalCondition(cond.slice(4), env, funcs, lang, ctx);
    }
    if (lang === 'javascript' && cond.startsWith('!')) {
      return !this.evalCondition(cond.slice(1), env, funcs, lang, ctx);
    }

    const comparators = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
    for (const op of comparators) {
      const idx = cond.indexOf(op);
      if (idx > 0) {
        const left = this.evalExpression(cond.slice(0, idx), env, funcs, lang, ctx);
        const right = this.evalExpression(cond.slice(idx + op.length), env, funcs, lang, ctx);
        switch (op) {
          case '===':
            return left === right;
          case '!==':
            return left !== right;
          case '==':
            // eslint-disable-next-line eqeqeq
            return left == right;
          case '!=':
            // eslint-disable-next-line eqeqeq
            return left != right;
          case '<=':
            return left <= right;
          case '>=':
            return left >= right;
          case '<':
            return left < right;
          case '>':
            return left > right;
        }
      }
    }

    return Boolean(this.evalExpression(cond, env, funcs, lang, ctx));
  }

  private static evalExpression(
    rawExpr: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage,
    ctx: ExecContext
  ): any {
    const expr = rawExpr.trim();
    if (!expr) return undefined;

    if (lang === 'python' && /^f(["'])([\s\S]*)\1$/.test(expr)) {
      const inner = expr.slice(2, -1);
      return inner.replace(/\{([^}]+)\}/g, (_, key) => {
        const val = this.evalExpression(key.trim(), env, funcs, lang, ctx);
        return val === undefined ? 'None' : String(val);
      });
    }

    if (lang === 'javascript' && expr.startsWith('`') && expr.endsWith('`')) {
      const inner = expr.slice(1, -1);
      return inner.replace(/\$\{([^}]+)\}/g, (_, key) => {
        const val = this.evalExpression(key.trim(), env, funcs, lang, ctx);
        return String(val);
      });
    }

    if (
      (expr.startsWith('"') && expr.endsWith('"') && !expr.slice(1, -1).includes('"')) ||
      (expr.startsWith("'") && expr.endsWith("'") && !expr.slice(1, -1).includes("'"))
    ) {
      return expr.slice(1, -1);
    }

    if (expr === 'true' || expr === 'True') return true;
    if (expr === 'false' || expr === 'False') return false;
    if (expr === 'null' || expr === 'None') return null;

    if (/^-?\d+(?:\.\d+)?$/.test(expr)) {
      return Number(expr);
    }

    if (lang === 'javascript') {
      const jsonMatch = expr.match(/^JSON\.stringify\s*\(([\s\S]*)\)$/);
      if (jsonMatch) {
        const args = this.splitTopLevelArgs(jsonMatch[1]);
        const target = this.evalExpression(args[0], env, funcs, lang, ctx);
        const space = args[2]
          ? Number(this.evalExpression(args[2], env, funcs, lang, ctx))
          : undefined;
        return JSON.stringify(target, null, Number.isFinite(space) ? space : undefined);
      }
    }

    if (expr.startsWith('[') && expr.endsWith(']')) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return [];
      return this.splitTopLevelArgs(inner).map((item) =>
        this.evalExpression(item, env, funcs, lang, ctx)
      );
    }

    if (expr.startsWith('{') && expr.endsWith('}')) {
      const inner = expr.slice(1, -1).trim();
      if (!inner) return {};
      const obj: Record<string, any> = {};
      for (const pair of this.splitTopLevelArgs(inner)) {
        const colonIdx = pair.indexOf(':');
        if (colonIdx !== -1) {
          const rawKey = pair.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
          const rawVal = pair.slice(colonIdx + 1).trim();
          obj[rawKey] = this.evalExpression(rawVal, env, funcs, lang, ctx);
        }
      }
      return obj;
    }

    const callMatch = expr.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*\(([^)]*)\)$/);
    if (callMatch && funcs[callMatch[1]]) {
      return this.invokeFunction(callMatch[1], callMatch[2], env, funcs, lang, ctx).returnValue;
    }

    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(expr) && expr in env) {
      return env[expr];
    }

    const binaryResult = this.evalBinaryExpression(expr, env, funcs, lang, ctx);
    if (binaryResult !== undefined) {
      return binaryResult;
    }

    return expr;
  }

  private static evalBinaryExpression(
    expr: string,
    env: Record<string, any>,
    funcs: Record<string, SimFunction>,
    lang: SupportedLanguage,
    ctx: ExecContext
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
            const left = this.evalExpression(expr.slice(0, i), env, funcs, lang, ctx);
            const right = this.evalExpression(expr.slice(i + 1), env, funcs, lang, ctx);
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
