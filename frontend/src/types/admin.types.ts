import { Role, UserStatus } from './auth.types';
import { LabCategory, LabDifficulty, SessionStatus } from './lab.types';
import { FileCategory } from './storage.types';

export interface AdminDashboardMetrics {
  users: {
    total: number;
    active: number;
    inactive: number;
    suspended: number;
    students: number;
    admins: number;
  };
  laboratories: {
    total: number;
    active: number;
    inactive: number;
  };
  labSessions: {
    total: number;
    inProgress: number;
    completed: number;
    abandoned: number;
  };
  storage: {
    totalFiles: number;
    usedBytes: string;
    allocatedBytes: string;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
  }>;
  recentAuditLogs: Array<{
    id: string;
    action: string;
    targetEntity: string;
    targetId?: string | null;
    previousVal?: string | null;
    newVal?: string | null;
    ipAddress?: string | null;
    createdAt: string;
    admin: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  department?: string | null;
  studentId?: string | null;
  semester?: number | null;
  lastLoginAt?: string | null;
  totalFiles: number;
  totalLabSessions: number;
  storageQuotaBytes: string;
  storageUsedBytes: string;
  storageRemainingBytes: string;
  storagePercentageUsed: number;
  createdAt: string;
}

export interface AdminUsersListResponse {
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    totalUsers: number;
    totalPages: number;
  };
}

export interface AdminUserDetails {
  user: {
    id: string;
    email: string;
    name: string;
    firstName: string;
    lastName: string;
    role: Role;
    status: UserStatus;
    profile?: {
      studentId?: string | null;
      department?: string | null;
      semester?: number | null;
      bio?: string | null;
      avatarUrl?: string | null;
      lastLoginAt?: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  };
  storageStats: {
    quotaBytes: string;
    usedBytes: string;
    remainingBytes: string;
    totalFiles: number;
    totalFolders: number;
  };
  labStats: {
    totalSessions: number;
    totalSubmissions: number;
    passedSubmissions: number;
    passRatePercentage: number;
    recentSessions: Array<{
      id: string;
      status: SessionStatus;
      score: number;
      startedAt: string;
      endedAt?: string | null;
      lab: {
        id: string;
        title: string;
        category: LabCategory;
        difficulty: LabDifficulty;
      };
    }>;
  };
  recentActivities: Array<{
    id: string;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
    createdAt: string;
  }>;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
  };
}

export interface AdminActivitiesResponse {
  activities: ActivityLogItem[];
  pagination: {
    page: number;
    limit: number;
    totalActivities: number;
    totalPages: number;
  };
}

export interface AuditLogItem {
  id: string;
  action: string;
  targetEntity: string;
  targetId?: string | null;
  previousVal?: string | null;
  newVal?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AdminAuditLogsResponse {
  auditLogs: AuditLogItem[];
  pagination: {
    page: number;
    limit: number;
    totalLogs: number;
    totalPages: number;
  };
}

export interface AdminStorageOverview {
  totalAllocatedQuotaBytes: string;
  totalUsedBytes: string;
  totalFiles: number;
  systemUtilizationPercentage: number;
  categoryDistribution: Record<FileCategory, { count: number; totalBytes: string }>;
}

export interface UserStorageQuotaItem {
  userId: string;
  email: string;
  name: string;
  role: Role;
  quotaBytes: string;
  usedBytes: string;
  percentageUsed: number;
  fileCount: number;
}

export interface LabGovernanceItem {
  id: string;
  title: string;
  slug: string;
  category: LabCategory;
  difficulty: LabDifficulty;
  isActive: boolean;
  estimatedMinutes: number;
  totalExercises: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  completionRatePercentage: number;
  averageScore: number;
  createdAt: string;
}

export interface LabPerformanceResponse {
  lab: {
    id: string;
    title: string;
    slug: string;
    category: LabCategory;
    difficulty: LabDifficulty;
    exercises: Array<{
      id: string;
      orderIndex: number;
      title: string;
      instruction: string;
    }>;
  };
  metrics: {
    totalSessions: number;
    completedSessions: number;
    completionRatePercentage: number;
    averageScore: number;
  };
  sessions: Array<{
    id: string;
    status: SessionStatus;
    score: number;
    startedAt: string;
    endedAt?: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      studentId?: string | null;
      department?: string | null;
    };
    passedExercisesCount: number;
    totalSubmissionsCount: number;
  }>;
  pagination: {
    page: number;
    limit: number;
    totalSessions: number;
    totalPages: number;
  };
}

export interface CreateLabPayload {
  title: string;
  slug: string;
  description: string;
  category: LabCategory;
  difficulty?: LabDifficulty;
  estimatedMinutes?: number;
}

export interface UpdateLabPayload {
  title?: string;
  description?: string;
  difficulty?: LabDifficulty;
  estimatedMinutes?: number;
  isActive?: boolean;
}

export interface CreateExercisePayload {
  orderIndex: number;
  title: string;
  instruction: string;
  hint?: string;
  expectedCommand?: string;
  expectedOutput?: string;
}

export interface UpdateExercisePayload {
  orderIndex?: number;
  title?: string;
  instruction?: string;
  hint?: string;
  expectedCommand?: string;
  expectedOutput?: string;
}
