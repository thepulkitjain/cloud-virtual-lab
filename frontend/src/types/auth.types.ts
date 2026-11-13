export type Role = 'STUDENT' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface UserProfile {
  id?: string;
  studentId?: string | null;
  department?: string | null;
  semester?: number | null;
  avatarUrl?: string | null;
  bio?: string | null;
  lastLoginAt?: string | null;
}

export interface StorageStatsSummary {
  quotaBytes: string;
  usedBytes: string;
  availableBytes: string;
  totalFiles: number;
  totalFolders: number;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  storageQuotaBytes: string;
  profile?: UserProfile | null;
  storageStats?: StorageStatsSummary;
  createdAt: string;
  updatedAt: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  studentId?: string;
  department?: string;
  semester?: number;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  department?: string;
  semester?: number;
  bio?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
