import apiClient from './api';
import { ApiResponse } from '../types/api.types';
import {
  AdminDashboardMetrics,
  AdminUsersListResponse,
  AdminUserDetails,
  AdminActivitiesResponse,
  AdminAuditLogsResponse,
  LabGovernanceItem,
  LabPerformanceResponse,
  CreateLabPayload,
  UpdateLabPayload,
  CreateExercisePayload,
  UpdateExercisePayload,
} from '../types/admin.types';
import { Role, UserStatus } from '../types/auth.types';

export class AdminService {
  /**
   * 1. Get system-wide administrative dashboard metrics
   */
  static async getDashboard(): Promise<AdminDashboardMetrics> {
    const res = await apiClient.get<ApiResponse<{ metrics: AdminDashboardMetrics }>>(
      '/admin/dashboard'
    );
    return res.data.data!.metrics;
  }

  /**
   * 2. List registered users with search, role/status filters, and pagination
   */
  static async listUsers(params?: {
    search?: string;
    role?: Role;
    status?: UserStatus;
    page?: number;
    limit?: number;
    sortBy?: 'name' | 'email' | 'createdAt' | 'status';
    sortOrder?: 'asc' | 'desc';
  }): Promise<AdminUsersListResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.append('search', params.search);
      if (params.role) query.append('role', params.role);
      if (params.status) query.append('status', params.status);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
      if (params.sortBy) query.append('sortBy', params.sortBy);
      if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    }

    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<AdminUsersListResponse>>(`/admin/users${qStr}`);
    return res.data.data!;
  }

  /**
   * 3. Get detailed single user profile with storage & lab statistics
   */
  static async getUser(userId: string): Promise<AdminUserDetails> {
    const res = await apiClient.get<ApiResponse<AdminUserDetails>>(`/admin/users/${userId}`);
    return res.data.data!;
  }

  /**
   * 4. Update user account status (ACTIVE, INACTIVE, SUSPENDED)
   */
  static async updateUserStatus(userId: string, status: UserStatus): Promise<any> {
    const res = await apiClient.patch<ApiResponse>(`/admin/users/${userId}/status`, { status });
    return res.data.data;
  }

  /**
   * 5. Update user role (STUDENT, ADMIN)
   */
  static async updateUserRole(userId: string, role: Role): Promise<any> {
    const res = await apiClient.patch<ApiResponse>(`/admin/users/${userId}/role`, { role });
    return res.data.data;
  }

  /**
   * 6. List system user activities
   */
  static async listActivities(params?: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminActivitiesResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.action) query.append('action', params.action);
      if (params.userId) query.append('userId', params.userId);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
    }

    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<AdminActivitiesResponse>>(
      `/admin/activities${qStr}`
    );
    return res.data.data!;
  }

  /**
   * 7. List administrative audit logs
   */
  static async listAuditLogs(params?: {
    action?: string;
    targetEntity?: string;
    adminId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminAuditLogsResponse> {
    const query = new URLSearchParams();
    if (params) {
      if (params.action) query.append('action', params.action);
      if (params.targetEntity) query.append('targetEntity', params.targetEntity);
      if (params.adminId) query.append('adminId', params.adminId);
      if (params.startDate) query.append('startDate', params.startDate);
      if (params.endDate) query.append('endDate', params.endDate);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));
    }

    const qStr = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<ApiResponse<AdminAuditLogsResponse>>(
      `/admin/audit-logs${qStr}`
    );
    return res.data.data!;
  }

  /**
   * 8. Get laboratory governance overview with metrics
   */
  static async getLabGovernance(): Promise<LabGovernanceItem[]> {
    const res = await apiClient.get<ApiResponse<{ laboratories: LabGovernanceItem[] }>>(
      '/admin/labs/governance'
    );
    return res.data.data?.laboratories || [];
  }

  /**
   * 9. Get student performance metrics for a specific laboratory
   */
  static async getLabPerformance(
    labId: string,
    page = 1,
    limit = 20
  ): Promise<LabPerformanceResponse> {
    const res = await apiClient.get<ApiResponse<LabPerformanceResponse>>(
      `/admin/labs/${labId}/performance?page=${page}&limit=${limit}`
    );
    return res.data.data!;
  }

  /**
   * 10. Toggle laboratory active/inactive status
   */
  static async toggleLabStatus(labId: string, isActive: boolean): Promise<any> {
    const res = await apiClient.patch<ApiResponse>(`/admin/labs/${labId}/status`, { isActive });
    return res.data.data;
  }

  /**
   * 11. Create a new laboratory
   */
  static async createLab(payload: CreateLabPayload): Promise<any> {
    const res = await apiClient.post<ApiResponse>('/admin/labs', payload);
    return res.data.data;
  }

  /**
   * 12. Update laboratory details
   */
  static async updateLab(labId: string, payload: UpdateLabPayload): Promise<any> {
    const res = await apiClient.put<ApiResponse>(`/admin/labs/${labId}`, payload);
    return res.data.data;
  }

  /**
   * 13. Create lab exercise
   */
  static async createExercise(labId: string, payload: CreateExercisePayload): Promise<any> {
    const res = await apiClient.post<ApiResponse>(`/admin/labs/${labId}/exercises`, payload);
    return res.data.data;
  }

  /**
   * 14. Update lab exercise
   */
  static async updateExercise(exerciseId: string, payload: UpdateExercisePayload): Promise<any> {
    const res = await apiClient.put<ApiResponse>(`/admin/exercises/${exerciseId}`, payload);
    return res.data.data;
  }

  /**
   * 15. Delete lab exercise
   */
  static async deleteExercise(exerciseId: string): Promise<string> {
    const res = await apiClient.delete<ApiResponse>(`/admin/exercises/${exerciseId}`);
    return res.data.message;
  }
}

export default AdminService;
