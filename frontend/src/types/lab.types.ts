export type LabCategory = 'LINUX' | 'NETWORKING' | 'PROGRAMMING' | 'DATABASE';
export type LabDifficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type SubmissionStatus = 'PASSED' | 'FAILED' | 'PENDING';

export interface LabExercise {
  id: string;
  labId: string;
  orderIndex: number;
  title: string;
  instruction: string;
  hint?: string | null;
  expectedCommand?: string | null;
  expectedOutput?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lab {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: LabCategory;
  difficulty: LabDifficulty;
  estimatedMinutes: number;
  isActive: boolean;
  exercises?: LabExercise[];
  _count?: {
    exercises: number;
    sessions?: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface ExerciseSubmission {
  id: string;
  sessionId: string;
  userId: string;
  exerciseId: string;
  commandInput: string;
  outputResult: string;
  status: SubmissionStatus;
  submittedAt: string;
  exercise?: LabExercise;
}

export interface LabSession {
  id: string;
  userId: string;
  labId: string;
  lab?: Lab;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string | null;
  score: number;
  submissions?: ExerciseSubmission[];
  _count?: {
    submissions: number;
  };
}

export interface ExecuteCommandPayload {
  command: string;
  exerciseId?: string;
}

export interface ExecuteCommandResult {
  command: string;
  output: string;
  currentPath?: string;
  isError: boolean;
  exitCode: number;
  timestamp: string;
}

export interface SubmitExercisePayload {
  exerciseId: string;
  commandInput: string;
  outputResult: string;
}
