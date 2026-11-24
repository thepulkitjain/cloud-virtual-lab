import apiClient from './api';
import { ApiResponse } from '../types/api.types';
import {
  Lab,
  LabSession,
  ExecuteCommandPayload,
  ExecuteCommandResult,
  TabCompletionResult,
} from '../types/lab.types';

export interface ExecuteResponse extends ExecuteCommandResult {
  currentScore: number;
  exercisePassed?: boolean;
  feedbackMessage?: string;
  submission?: any;
}

export class LabService {
  /**
   * Retrieve list of all laboratories, optionally filtered by category, difficulty, or search keyword.
   */
  static async getLabs(filters?: {
    category?: string;
    difficulty?: string;
    search?: string;
  }): Promise<Lab[]> {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<ApiResponse<{ labs: Lab[] }>>(`/labs${query}`);
    return res.data.data?.labs || [];
  }

  /**
   * Retrieve detailed information for a single lab by ID or slug, including active student session.
   */
  static async getLab(idOrSlug: string): Promise<Lab & { activeSession?: LabSession | null }> {
    const res = await apiClient.get<ApiResponse<{ lab: Lab & { activeSession?: LabSession | null } }>>(
      `/labs/${idOrSlug}`
    );
    return res.data.data!.lab;
  }

  /**
   * Start a new lab session or resume an existing IN_PROGRESS session.
   */
  static async startSession(
    labId: string
  ): Promise<{ session: LabSession; lab: Lab }> {
    const res = await apiClient.post<ApiResponse<{ session: LabSession; lab: Lab }>>(
      `/labs/${labId}/sessions`
    );
    return res.data.data!;
  }

  /**
   * Execute an allowlisted simulated command within the isolated session sandbox.
   */
  static async executeCommand(
    sessionId: string,
    payload: ExecuteCommandPayload
  ): Promise<ExecuteResponse> {
    const res = await apiClient.post<ApiResponse<ExecuteResponse>>(
      `/labs/sessions/${sessionId}/execute`,
      payload
    );
    return res.data.data!;
  }

  /**
   * Submit an exercise solution for grading and score accumulation.
   */
  static async submitExercise(
    sessionId: string,
    payload: { commandInput: string; exerciseId: string }
  ): Promise<ExecuteResponse> {
    const res = await apiClient.post<ApiResponse<ExecuteResponse>>(
      `/labs/sessions/${sessionId}/submit`,
      payload
    );
    return res.data.data!;
  }

  /**
   * Request tab autocomplete suggestions for a command line in an active session.
   */
  static async tabComplete(
    sessionId: string,
    line: string
  ): Promise<TabCompletionResult> {
    const res = await apiClient.post<ApiResponse<TabCompletionResult>>(
      `/labs/sessions/${sessionId}/complete`,
      { line }
    );
    return res.data.data!;
  }

  /**
   * End and complete a lab session.
   */
  static async endSession(sessionId: string): Promise<LabSession> {
    const res = await apiClient.post<ApiResponse<{ session: LabSession }>>(
      `/labs/sessions/${sessionId}/end`
    );
    return res.data.data!.session;
  }

  /**
   * Retrieve all past and current lab sessions for the logged-in student.
   */
  static async getMySessions(): Promise<LabSession[]> {
    const res = await apiClient.get<ApiResponse<{ sessions: LabSession[] }>>('/labs/my-sessions');
    return res.data.data?.sessions || [];
  }

  /**
   * Retrieve a specific lab session with all its submission history.
   */
  static async getSession(sessionId: string): Promise<LabSession> {
    const res = await apiClient.get<ApiResponse<{ session: LabSession }>>(
      `/labs/sessions/${sessionId}`
    );
    return res.data.data!.session;
  }
}

export default LabService;
