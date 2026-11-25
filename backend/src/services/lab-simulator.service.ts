import { LabCategory } from '@prisma/client';
import { LinuxSimulator, LinuxSessionState, VirtualNode, TabCompletionResult } from './simulators/linux.simulator';
import { NetworkingSimulator } from './simulators/networking.simulator';
import { ProgrammingSimulator, SupportedLanguage } from './simulators/programming.simulator';
import { DatabaseSimulator, DbSessionState } from './simulators/database.simulator';
import { redisService } from './redis/redis.service';
import envConfig from '../config/env.config';

export interface SessionSimulatorMemory {
  linuxState?: LinuxSessionState;
  dbState?: DbSessionState;
}

interface SerializedVirtualNode {
  name: string;
  isDirectory: boolean;
  content: string;
  children: Array<[string, SerializedVirtualNode]>;
}

interface SerializedLinuxState {
  currentPath: string;
  root: SerializedVirtualNode;
}

interface SerializedSessionMemory {
  linuxState?: SerializedLinuxState;
  dbState?: DbSessionState;
}

interface InMemoryEntry {
  state: SessionSimulatorMemory;
  expiresAt: number;
}

const SIMULATOR_KEY_PREFIX = 'sim:session:';
const MAX_VFS_DEPTH = 64;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// In-memory fallback store keyed by sessionId with TTL expiration
const sessionMemoryStore = new Map<string, InMemoryEntry>();

// Periodic sweep for expired fallback entries (never blocks process exit)
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, entry] of sessionMemoryStore.entries()) {
    if (entry.expiresAt <= now) {
      sessionMemoryStore.delete(sessionId);
    }
  }
}, 10 * 60 * 1000).unref();

export interface SimulatorExecutionResult {
  output: string;
  currentPath?: string;
  exercisePassed: boolean;
  feedbackMessage?: string;
}

export class LabSimulatorService {
  private static getRedisKey(sessionId: string): string {
    return `${SIMULATOR_KEY_PREFIX}${sessionId}`;
  }

  private static serializeVirtualNode(node: VirtualNode): SerializedVirtualNode {
    const children: Array<[string, SerializedVirtualNode]> = [];
    for (const [key, child] of node.children.entries()) {
      if (!FORBIDDEN_KEYS.has(key)) {
        children.push([key, this.serializeVirtualNode(child)]);
      }
    }
    return {
      name: node.name,
      isDirectory: node.isDirectory,
      content: node.content,
      children,
    };
  }

  private static deserializeVirtualNode(raw: unknown, depth = 0): VirtualNode | null {
    if (depth > MAX_VFS_DEPTH || !raw || typeof raw !== 'object') {
      return null;
    }
    const obj = raw as Record<string, unknown>;
    if (
      typeof obj.name !== 'string' ||
      typeof obj.isDirectory !== 'boolean' ||
      typeof obj.content !== 'string' ||
      !Array.isArray(obj.children)
    ) {
      return null;
    }

    const children = new Map<string, VirtualNode>();
    for (const entry of obj.children) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      const [key, childRaw] = entry;
      if (typeof key !== 'string' || FORBIDDEN_KEYS.has(key)) return null;
      const childNode = this.deserializeVirtualNode(childRaw, depth + 1);
      if (!childNode) return null;
      children.set(key, childNode);
    }

    return {
      name: obj.name,
      isDirectory: obj.isDirectory,
      content: obj.content,
      children,
    };
  }

  private static serializeState(state: SessionSimulatorMemory): string {
    const payload: SerializedSessionMemory = {};
    if (state.linuxState) {
      payload.linuxState = {
        currentPath: state.linuxState.currentPath,
        root: this.serializeVirtualNode(state.linuxState.root),
      };
    }
    if (state.dbState) {
      payload.dbState = state.dbState;
    }
    return JSON.stringify(payload);
  }

  private static deserializeState(rawJson: string): SessionSimulatorMemory | null {
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      if (!parsed || typeof parsed !== 'object') return null;

      const obj = parsed as Record<string, unknown>;
      const result: SessionSimulatorMemory = {};

      if (obj.linuxState !== undefined) {
        if (!obj.linuxState || typeof obj.linuxState !== 'object') return null;
        const ls = obj.linuxState as Record<string, unknown>;
        if (typeof ls.currentPath !== 'string') return null;
        const root = this.deserializeVirtualNode(ls.root, 0);
        if (!root) return null;
        result.linuxState = {
          currentPath: ls.currentPath,
          root,
        };
      }

      if (obj.dbState !== undefined) {
        if (!obj.dbState || typeof obj.dbState !== 'object') return null;
        const db = obj.dbState as Record<string, unknown>;
        if (!Array.isArray(db.students) || !Array.isArray(db.courses)) return null;
        result.dbState = {
          students: db.students as DbSessionState['students'],
          courses: db.courses as DbSessionState['courses'],
        };
      }

      return result;
    } catch {
      return null;
    }
  }

  private static ensureCategoryState(
    state: SessionSimulatorMemory,
    category: LabCategory
  ): SessionSimulatorMemory {
    if (category === LabCategory.LINUX && !state.linuxState) {
      state.linuxState = LinuxSimulator.createInitialState();
    } else if (category === LabCategory.DATABASE && !state.dbState) {
      state.dbState = DatabaseSimulator.createInitialState();
    }
    return state;
  }

  /**
   * Loads simulator state from Redis (primary) or in-memory fallback (with TTL).
   */
  private static async loadOrCreateState(
    sessionId: string,
    category: LabCategory
  ): Promise<SessionSimulatorMemory> {
    if (redisService.isAvailable()) {
      const raw = await redisService.get(this.getRedisKey(sessionId));
      if (raw) {
        const restored = this.deserializeState(raw);
        if (restored) {
          return this.ensureCategoryState(restored, category);
        }
      }
    }

    const existing = sessionMemoryStore.get(sessionId);
    if (existing) {
      if (existing.expiresAt > Date.now()) {
        return this.ensureCategoryState(existing.state, category);
      }
      sessionMemoryStore.delete(sessionId);
    }

    return this.ensureCategoryState({}, category);
  }

  /**
   * Persists simulator state to Redis with TTL and updates bounded in-memory fallback.
   */
  private static async saveState(
    sessionId: string,
    state: SessionSimulatorMemory,
    ttlOverrideSeconds?: number
  ): Promise<void> {
    if (!state.linuxState && !state.dbState) {
      return;
    }

    const ttlSeconds = Math.max(1, ttlOverrideSeconds ?? envConfig.simulatorStateTtlSeconds);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    sessionMemoryStore.set(sessionId, { state, expiresAt });

    if (redisService.isAvailable()) {
      await redisService.set(this.getRedisKey(sessionId), this.serializeState(state), ttlSeconds);
    }
  }

  /**
   * Dispatches a student command to the appropriate simulator engine
   */
  static async execute(
    sessionId: string,
    category: LabCategory,
    commandStr: string,
    exerciseCriteria?: { expectedCommand?: string | null; expectedOutput?: string | null },
    codeOptions?: { code?: string; language?: SupportedLanguage },
    ttlOverrideSeconds?: number
  ): Promise<SimulatorExecutionResult> {
    const memory = await this.loadOrCreateState(sessionId, category);
    let output = '';
    let currentPath: string | undefined;

    switch (category) {
      case LabCategory.LINUX: {
        if (!memory.linuxState) {
          memory.linuxState = LinuxSimulator.createInitialState();
        }
        const res = LinuxSimulator.execute(commandStr, memory.linuxState);
        output = res.output;
        currentPath = res.currentPath;
        await this.saveState(sessionId, memory, ttlOverrideSeconds);
        break;
      }

      case LabCategory.NETWORKING: {
        output = NetworkingSimulator.execute(commandStr);
        break;
      }

      case LabCategory.PROGRAMMING: {
        output = ProgrammingSimulator.execute(commandStr, codeOptions?.code, codeOptions?.language);
        break;
      }

      case LabCategory.DATABASE: {
        if (!memory.dbState) {
          memory.dbState = DatabaseSimulator.createInitialState();
        }
        output = DatabaseSimulator.execute(commandStr, memory.dbState);
        await this.saveState(sessionId, memory, ttlOverrideSeconds);
        break;
      }

      default: {
        output = `Unsupported laboratory category: ${category}`;
      }
    }

    // Evaluate criteria
    let exercisePassed = false;
    let feedbackMessage: string | undefined;

    if (exerciseCriteria) {
      const normalizedInput = commandStr.trim().toLowerCase();
      const expectedCmd = exerciseCriteria.expectedCommand?.trim().toLowerCase();
      const expectedOut = exerciseCriteria.expectedOutput?.trim().toLowerCase();

      // Check if command matches pattern or output satisfies requirement
      const cmdMatches = expectedCmd && (normalizedInput === expectedCmd || normalizedInput.includes(expectedCmd));
      const outMatches = expectedOut && output.toLowerCase().includes(expectedOut);

      if (cmdMatches || outMatches) {
        exercisePassed = true;
        feedbackMessage = 'Great job! Exercise criteria verified and passed.';
      }
    }

    return {
      output,
      currentPath,
      exercisePassed,
      feedbackMessage,
    };
  }

  /**
   * Cleans up session state from both in-memory store and Redis when session ends
   */
  static async destroySession(sessionId: string): Promise<void> {
    sessionMemoryStore.delete(sessionId);
    if (redisService.isAvailable()) {
      await redisService.del(this.getRedisKey(sessionId));
    }
  }

  /**
   * Checks whether in-memory fallback state currently exists for a session (for diagnostics/testing)
   */
  static hasInMemoryState(sessionId: string): boolean {
    const entry = sessionMemoryStore.get(sessionId);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      sessionMemoryStore.delete(sessionId);
      return false;
    }
    return true;
  }

  /**
   * Clears all in-memory fallback entries (for isolated unit testing)
   */
  static clearInMemoryStore(): void {
    sessionMemoryStore.clear();
  }

  /**
   * Generates tab autocomplete suggestions for terminal commands and paths
   */
  static async tabComplete(
    sessionId: string,
    category: LabCategory,
    commandLine: string
  ): Promise<TabCompletionResult> {
    const memory = await this.loadOrCreateState(sessionId, category);

    if (category === LabCategory.LINUX) {
      if (!memory.linuxState) {
        memory.linuxState = LinuxSimulator.createInitialState();
      }
      return LinuxSimulator.getCompletions(commandLine, memory.linuxState);
    }

    return {
      completedLine: commandLine,
      matches: [],
      prefix: '',
      hasMultiple: false,
      isCommand: false,
    };
  }
}
