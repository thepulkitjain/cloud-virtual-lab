import { LabCategory } from '@prisma/client';
import { LinuxSimulator, LinuxSessionState, TabCompletionResult } from './simulators/linux.simulator';
import { NetworkingSimulator } from './simulators/networking.simulator';
import { ProgrammingSimulator } from './simulators/programming.simulator';
import { DatabaseSimulator, DbSessionState } from './simulators/database.simulator';

interface SessionSimulatorMemory {
  linuxState?: LinuxSessionState;
  dbState?: DbSessionState;
}

// In-memory session state repository keyed by sessionId
const sessionMemoryStore = new Map<string, SessionSimulatorMemory>();

export interface SimulatorExecutionResult {
  output: string;
  currentPath?: string;
  exercisePassed: boolean;
  feedbackMessage?: string;
}

export class LabSimulatorService {
  /**
   * Initializes or returns simulator state for a given lab session
   */
  private static getOrCreateState(sessionId: string, category: LabCategory): SessionSimulatorMemory {
    let state = sessionMemoryStore.get(sessionId);
    if (!state) {
      state = {};
      if (category === LabCategory.LINUX) {
        state.linuxState = LinuxSimulator.createInitialState();
      } else if (category === LabCategory.DATABASE) {
        state.dbState = DatabaseSimulator.createInitialState();
      }
      sessionMemoryStore.set(sessionId, state);
    }
    return state;
  }

  /**
   * Dispatches a student command to the appropriate simulator engine
   */
  static execute(
    sessionId: string,
    category: LabCategory,
    commandStr: string,
    exerciseCriteria?: { expectedCommand?: string | null; expectedOutput?: string | null }
  ): SimulatorExecutionResult {
    const memory = this.getOrCreateState(sessionId, category);
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
        break;
      }

      case LabCategory.NETWORKING: {
        output = NetworkingSimulator.execute(commandStr);
        break;
      }

      case LabCategory.PROGRAMMING: {
        output = ProgrammingSimulator.execute(commandStr);
        break;
      }

      case LabCategory.DATABASE: {
        if (!memory.dbState) {
          memory.dbState = DatabaseSimulator.createInitialState();
        }
        output = DatabaseSimulator.execute(commandStr, memory.dbState);
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
   * Cleans up session memory when session ends
   */
  static destroySession(sessionId: string): void {
    sessionMemoryStore.delete(sessionId);
  }

  /**
   * Generates tab autocomplete suggestions for terminal commands and paths
   */
  static tabComplete(
    sessionId: string,
    category: LabCategory,
    commandLine: string
  ): TabCompletionResult {
    const memory = this.getOrCreateState(sessionId, category);

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
