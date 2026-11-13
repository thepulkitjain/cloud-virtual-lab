import apiClient from './api';
import { ApiResponse } from '../types/api.types';
import {
  User,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  ChangePasswordPayload,
} from '../types/auth.types';

export class AuthService {
  /**
   * Log in user using email and password.
   * On success, backend sets an HTTP-only cookie with JWT.
   */
  static async login(payload: LoginPayload): Promise<{ user: User; token: string }> {
    const response = await apiClient.post<ApiResponse<{ user: User; token: string }>>(
      '/auth/login',
      payload
    );
    return response.data.data!;
  }

  /**
   * Register a new student account.
   * Role is automatically set to STUDENT by backend security rules.
   */
  static async register(payload: RegisterPayload): Promise<{ user: User; token: string }> {
    const response = await apiClient.post<ApiResponse<{ user: User; token: string }>>(
      '/auth/register',
      payload
    );
    return response.data.data!;
  }

  /**
   * Retrieve the current authenticated user session based on HTTP-only cookie.
   */
  static async getMe(): Promise<{ user: User }> {
    const response = await apiClient.get<ApiResponse<{ user: User }>>('/auth/me');
    return response.data.data!;
  }

  /**
   * Log out current user, clearing the HTTP-only cookie.
   */
  static async logout(): Promise<void> {
    await apiClient.post<ApiResponse>('/auth/logout');
  }

  /**
   * Update current user profile fields.
   */
  static async updateProfile(payload: UpdateProfilePayload): Promise<{ user: User }> {
    const response = await apiClient.put<ApiResponse<{ user: User }>>('/auth/profile', payload);
    return response.data.data!;
  }

  /**
   * Change user password securely.
   */
  static async changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
    const response = await apiClient.post<ApiResponse>('/auth/change-password', payload);
    return { message: response.data.message };
  }
}

export default AuthService;
