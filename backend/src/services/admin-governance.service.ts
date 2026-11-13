import { Role, UserStatus, LabCategory, SessionStatus, SubmissionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types';
import { tokenRevocationService } from './redis/token-revocation.service';

export interface ListUsersOptions {
  search?: string;
  role?: Role;
  status?: UserStatus;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'email' | 'createdAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface ListActivitiesOptions {
  action?: string;
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface ListAuditLogsOptions {
  action?: string;
  targetEntity?: string;
  adminId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class AdminGovernanceService {
  /**
   * Aggregates comprehensive system dashboard metrics
   */
  static async getDashboardMetrics() {
    // 1. User metrics
    const [totalUsers, statusGroups, roleGroups] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),
    ]);

    const usersByStatus = {
      ACTIVE: 0,
      INACTIVE: 0,
      SUSPENDED: 0,
    };
    statusGroups.forEach((g) => {
      usersByStatus[g.status] = g._count.id;
    });

    const usersByRole = {
      STUDENT: 0,
      ADMIN: 0,
    };
    roleGroups.forEach((g) => {
      usersByRole[g.role] = g._count.id;
    });

    // 2. Laboratory & session metrics
    const [totalLabs, activeLabs, totalSessions, sessionStatusGroups] = await Promise.all([
      prisma.lab.count(),
      prisma.lab.count({ where: { isActive: true } }),
      prisma.labSession.count(),
      prisma.labSession.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const sessionsByStatus = {
      IN_PROGRESS: 0,
      COMPLETED: 0,
      ABANDONED: 0,
    };
    sessionStatusGroups.forEach((g) => {
      sessionsByStatus[g.status] = g._count.id;
    });

    // 3. Storage metrics
    const [fileCount, fileStorageSum, quotaSum] = await Promise.all([
      prisma.storedFile.count(),
      prisma.storedFile.aggregate({ _sum: { sizeBytes: true } }),
      prisma.user.aggregate({ _sum: { storageQuotaBytes: true } }),
    ]);

    const totalStorageUsedBytes = fileStorageSum._sum.sizeBytes || BigInt(0);
    const totalStorageAllocatedBytes = quotaSum._sum.storageQuotaBytes || BigInt(0);

    // 4. Recent Activities (Latest 10)
    const recentActivities = await prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // 5. Recent Audit Logs (Latest 10)
    const recentAuditLogs = await prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      users: {
        total: totalUsers,
        active: usersByStatus.ACTIVE,
        inactive: usersByStatus.INACTIVE,
        suspended: usersByStatus.SUSPENDED,
        students: usersByRole.STUDENT,
        admins: usersByRole.ADMIN,
      },
      laboratories: {
        total: totalLabs,
        active: activeLabs,
        inactive: totalLabs - activeLabs,
      },
      labSessions: {
        total: totalSessions,
        inProgress: sessionsByStatus.IN_PROGRESS,
        completed: sessionsByStatus.COMPLETED,
        abandoned: sessionsByStatus.ABANDONED,
      },
      storage: {
        totalFiles: fileCount,
        usedBytes: totalStorageUsedBytes.toString(),
        allocatedBytes: totalStorageAllocatedBytes.toString(),
      },
      recentActivities: recentActivities.map((a) => ({
        id: a.id,
        action: a.action,
        details: a.details,
        ipAddress: a.ipAddress,
        createdAt: a.createdAt,
        user: {
          id: a.user.id,
          name: `${a.user.firstName} ${a.user.lastName}`,
          email: a.user.email,
          role: a.user.role,
        },
      })),
      recentAuditLogs: recentAuditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        targetEntity: l.targetEntity,
        targetId: l.targetId,
        previousVal: l.previousVal,
        newVal: l.newVal,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt,
        admin: {
          id: l.admin.id,
          name: `${l.admin.firstName} ${l.admin.lastName}`,
          email: l.admin.email,
        },
      })),
    };
  }

  /**
   * Lists registered users with search, role/status filtering, and pagination
   */
  static async listUsers(options: ListUsersOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.role) {
      where.role = options.role;
    }
    if (options.status) {
      where.status = options.status;
    }
    if (options.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';

    if (options.sortBy === 'name') {
      orderBy.firstName = sortOrder;
    } else if (options.sortBy === 'email') {
      orderBy.email = sortOrder;
    } else if (options.sortBy === 'status') {
      orderBy.status = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [totalUsers, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          storageQuotaBytes: true,
          createdAt: true,
          updatedAt: true,
          profile: {
            select: {
              studentId: true,
              department: true,
              semester: true,
              lastLoginAt: true,
            },
          },
          _count: {
            select: {
              files: true,
              labSessions: true,
            },
          },
        },
      }),
    ]);

    // Aggregate file storage used per user
    const userIds = users.map((u) => u.id);
    const storageSums = await prisma.storedFile.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { sizeBytes: true },
    });

    const sumMap = new Map(storageSums.map((s) => [s.userId, s._sum.sizeBytes || BigInt(0)]));

    const formattedUsers = users.map((u) => {
      const usedBytes = sumMap.get(u.id) || BigInt(0);
      const remainingBytes =
        u.storageQuotaBytes > usedBytes ? u.storageQuotaBytes - usedBytes : BigInt(0);
      const percentageUsed =
        u.storageQuotaBytes > BigInt(0)
          ? Math.min(100, Number((usedBytes * BigInt(10000)) / u.storageQuotaBytes) / 100)
          : 0;

      return {
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        status: u.status,
        department: u.profile?.department || null,
        studentId: u.profile?.studentId || null,
        semester: u.profile?.semester || null,
        lastLoginAt: u.profile?.lastLoginAt || null,
        totalFiles: u._count.files,
        totalLabSessions: u._count.labSessions,
        storageQuotaBytes: u.storageQuotaBytes.toString(),
        storageUsedBytes: usedBytes.toString(),
        storageRemainingBytes: remainingBytes.toString(),
        storagePercentageUsed: percentageUsed,
        createdAt: u.createdAt,
      };
    });

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    };
  }

  /**
   * Retrieves comprehensive user details with lab and storage metrics
   */
  static async getUserDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        storageQuotaBytes: true,
        createdAt: true,
        updatedAt: true,
        profile: true,
        _count: {
          select: {
            files: true,
            folders: true,
            labSessions: true,
            submissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // 1. Storage metrics
    const storageSum = await prisma.storedFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });
    const usedBytes = storageSum._sum.sizeBytes || BigInt(0);

    // 2. Lab performance metrics
    const sessions = await prisma.labSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
      include: {
        lab: {
          select: {
            id: true,
            title: true,
            category: true,
            difficulty: true,
          },
        },
      },
    });

    const passedSubmissionsCount = await prisma.exerciseSubmission.count({
      where: {
        userId,
        status: SubmissionStatus.PASSED,
      },
    });

    const totalSubmissions = user._count.submissions;
    const submissionPassRate =
      totalSubmissions > 0
        ? Math.round((passedSubmissionsCount / totalSubmissions) * 100)
        : 0;

    // 3. Recent activity logs
    const activities = await prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        profile: user.profile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      storageStats: {
        quotaBytes: user.storageQuotaBytes.toString(),
        usedBytes: usedBytes.toString(),
        remainingBytes: (user.storageQuotaBytes > usedBytes ? user.storageQuotaBytes - usedBytes : BigInt(0)).toString(),
        totalFiles: user._count.files,
        totalFolders: user._count.folders,
      },
      labStats: {
        totalSessions: user._count.labSessions,
        totalSubmissions,
        passedSubmissions: passedSubmissionsCount,
        passRatePercentage: submissionPassRate,
        recentSessions: sessions,
      },
      recentActivities: activities,
    };
  }

  /**
   * Updates user account status (ACTIVE, INACTIVE, SUSPENDED) with strict self-protection rules
   */
  static async updateUserStatus(
    adminId: string,
    targetUserId: string,
    newStatus: UserStatus,
    ipAddress?: string
  ) {
    // Self-Protection Rule: An administrator cannot deactivate or suspend their own account
    if (adminId === targetUserId) {
      throw new AppError(
        'Self-protection rule violation: You cannot deactivate or change the status of your own account.',
        400
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new AppError('User not found.', 404);
    }

    // System Protection Rule: Protect the root administrator account
    const rootAdminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    if (targetUser.email.toLowerCase() === rootAdminEmail.toLowerCase() && newStatus !== UserStatus.ACTIVE) {
      throw new AppError(
        'System protection rule violation: The primary system administrator account cannot be deactivated.',
        400
      );
    }

    const previousStatus = targetUser.status;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { status: newStatus },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
        },
      });

      // Write immutable AuditLog
      await tx.auditLog.create({
        data: {
          adminId,
          targetEntity: 'USER',
          targetId: targetUserId,
          action: 'UPDATE_USER_STATUS',
          previousVal: JSON.stringify({ status: previousStatus }),
          newVal: JSON.stringify({ status: newStatus }),
          ipAddress: ipAddress || null,
        },
      });

      return updated;
    });

    // Invalidate all active distributed sessions when a user is suspended
    if (newStatus === UserStatus.SUSPENDED) {
      await tokenRevocationService.revokeAllUserTokens(targetUserId);
    } else if (newStatus === UserStatus.ACTIVE) {
      await tokenRevocationService.clearUserRevocation(targetUserId);
    }

    return {
      user: updatedUser,
      previousStatus,
    };
  }

  /**
   * Updates user role (STUDENT, ADMIN) with self-protection checks
   */
  static async updateUserRole(
    adminId: string,
    targetUserId: string,
    newRole: Role,
    ipAddress?: string
  ) {
    if (adminId === targetUserId) {
      throw new AppError(
        'Self-protection rule violation: You cannot modify your own administrative role.',
        400
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new AppError('User not found.', 404);
    }

    const rootAdminEmail = process.env.ADMIN_EMAIL || 'admin@virtuallab.edu';
    if (targetUser.email.toLowerCase() === rootAdminEmail.toLowerCase()) {
      throw new AppError(
        'System protection rule violation: The primary system administrator role cannot be altered.',
        400
      );
    }

    const previousRole = targetUser.role;

    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { role: newRole },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          targetEntity: 'USER',
          targetId: targetUserId,
          action: 'UPDATE_USER_ROLE',
          previousVal: JSON.stringify({ role: previousRole }),
          newVal: JSON.stringify({ role: newRole }),
          ipAddress: ipAddress || null,
        },
      });

      return updated;
    });

    return {
      user: updatedUser,
      previousRole,
    };
  }

  /**
   * Lists system activity logs with filters and pagination
   */
  static async listActivities(options: ListActivitiesOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.action) {
      where.action = { contains: options.action, mode: 'insensitive' };
    }
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [totalActivities, activities] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const formatted = activities.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details,
      ipAddress: a.ipAddress,
      createdAt: a.createdAt,
      user: {
        id: a.user.id,
        name: `${a.user.firstName} ${a.user.lastName}`,
        email: a.user.email,
        role: a.user.role,
      },
    }));

    return {
      activities: formatted,
      pagination: {
        page,
        limit,
        totalActivities,
        totalPages: Math.ceil(totalActivities / limit),
      },
    };
  }

  /**
   * Lists administrative audit logs with filters and pagination
   */
  static async listAuditLogs(options: ListAuditLogsOptions = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 25));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.action) {
      where.action = { contains: options.action, mode: 'insensitive' };
    }
    if (options.targetEntity) {
      where.targetEntity = options.targetEntity.toUpperCase();
    }
    if (options.adminId) {
      where.adminId = options.adminId;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [totalLogs, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    const formatted = logs.map((l) => ({
      id: l.id,
      action: l.action,
      targetEntity: l.targetEntity,
      targetId: l.targetId,
      previousVal: l.previousVal,
      newVal: l.newVal,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      admin: {
        id: l.admin.id,
        name: `${l.admin.firstName} ${l.admin.lastName}`,
        email: l.admin.email,
      },
    }));

    return {
      auditLogs: formatted,
      pagination: {
        page,
        limit,
        totalLogs,
        totalPages: Math.ceil(totalLogs / limit),
      },
    };
  }

  /**
   * Generates comprehensive laboratory governance metrics
   */
  static async getLabGovernanceOverview() {
    const labs = await prisma.lab.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        exercises: {
          select: { id: true, title: true, orderIndex: true },
        },
        sessions: {
          select: {
            id: true,
            status: true,
            score: true,
            startedAt: true,
            endedAt: true,
          },
        },
      },
    });

    const overview = labs.map((lab) => {
      const totalSessions = lab.sessions.length;
      const completedSessions = lab.sessions.filter((s) => s.status === SessionStatus.COMPLETED).length;
      const inProgressSessions = lab.sessions.filter((s) => s.status === SessionStatus.IN_PROGRESS).length;

      const completionRate =
        totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      const totalScore = lab.sessions.reduce((acc, s) => acc + s.score, 0);
      const averageScore = totalSessions > 0 ? Math.round(totalScore / totalSessions) : 0;

      return {
        id: lab.id,
        title: lab.title,
        slug: lab.slug,
        category: lab.category,
        difficulty: lab.difficulty,
        isActive: lab.isActive,
        estimatedMinutes: lab.estimatedMinutes,
        totalExercises: lab.exercises.length,
        totalSessions,
        completedSessions,
        inProgressSessions,
        completionRatePercentage: completionRate,
        averageScore,
        createdAt: lab.createdAt,
      };
    });

    return { laboratories: overview };
  }

  /**
   * Toggles active status of a laboratory with audit logging
   */
  static async toggleLabStatus(adminId: string, labId: string, isActive: boolean, ipAddress?: string) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
    });

    if (!lab) {
      throw new AppError('Laboratory not found.', 404);
    }

    const previousStatus = lab.isActive;

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.lab.update({
        where: { id: labId },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          adminId,
          targetEntity: 'LAB',
          targetId: labId,
          action: isActive ? 'ENABLE_LAB' : 'DISABLE_LAB',
          previousVal: JSON.stringify({ isActive: previousStatus }),
          newVal: JSON.stringify({ isActive }),
          ipAddress: ipAddress || null,
        },
      });

      return res;
    });

    return updated;
  }

  /**
   * Retrieves student performance and submissions for a specific laboratory
   */
  static async getLabStudentPerformance(labId: string, page = 1, limit = 20) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      include: {
        exercises: {
          orderBy: { orderIndex: 'asc' },
          select: { id: true, title: true, orderIndex: true },
        },
      },
    });

    if (!lab) {
      throw new AppError('Laboratory not found.', 404);
    }

    const skip = (Math.max(1, page) - 1) * limit;

    const [totalSessions, sessions] = await Promise.all([
      prisma.labSession.count({ where: { labId } }),
      prisma.labSession.findMany({
        where: { labId },
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              profile: {
                select: {
                  studentId: true,
                  department: true,
                },
              },
            },
          },
          submissions: {
            select: {
              id: true,
              exerciseId: true,
              status: true,
              submittedAt: true,
            },
          },
        },
      }),
    ]);

    const formattedSessions = sessions.map((s) => ({
      sessionId: s.id,
      student: {
        id: s.user.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        email: s.user.email,
        studentId: s.user.profile?.studentId || null,
        department: s.user.profile?.department || null,
      },
      status: s.status,
      score: s.score,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      totalSubmissions: s.submissions.length,
      passedExercisesCount: s.submissions.filter((sub) => sub.status === SubmissionStatus.PASSED).length,
    }));

    return {
      lab: {
        id: lab.id,
        title: lab.title,
        category: lab.category,
        difficulty: lab.difficulty,
        totalExercises: lab.exercises.length,
      },
      sessions: formattedSessions,
      pagination: {
        page,
        limit,
        totalSessions,
        totalPages: Math.ceil(totalSessions / limit),
      },
    };
  }
}
