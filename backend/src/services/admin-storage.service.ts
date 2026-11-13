import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import { AppError } from '../types';
import { getStorageUploadDirectory } from './storage.service';
import { getStorageProvider } from './storage';
import { FileCategory } from '@prisma/client';

export class AdminStorageService {
  /**
   * Generates a comprehensive system-wide storage overview for administrators
   */
  static async getStorageOverview() {
    // 1. Total files and total size
    const filesAgg = await prisma.storedFile.aggregate({
      _count: { id: true },
      _sum: { sizeBytes: true },
    });

    const totalFiles = filesAgg._count.id;
    const totalStorageUsedBytes = filesAgg._sum.sizeBytes || BigInt(0);

    // 2. Total quota allocated across all users
    const usersAgg = await prisma.user.aggregate({
      _count: { id: true },
      _sum: { storageQuotaBytes: true },
    });

    const totalUsers = usersAgg._count.id;
    const totalQuotaAllocatedBytes = usersAgg._sum.storageQuotaBytes || BigInt(0);

    // 3. Distribution by file category
    const categoryDistribution = await prisma.storedFile.groupBy({
      by: ['fileCategory'],
      _count: { id: true },
      _sum: { sizeBytes: true },
    });

    const formattedCategoryDistribution = categoryDistribution.map((item) => ({
      category: item.fileCategory,
      fileCount: item._count.id,
      totalBytes: (item._sum.sizeBytes || BigInt(0)).toString(),
    }));

    // 4. Top 5 storage consumers
    const topConsumersRaw = await prisma.storedFile.groupBy({
      by: ['userId'],
      _count: { id: true },
      _sum: { sizeBytes: true },
      orderBy: {
        _sum: {
          sizeBytes: 'desc',
        },
      },
      take: 5,
    });

    const userIds = topConsumersRaw.map((t) => t.userId);
    const topUsers = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        storageQuotaBytes: true,
      },
    });

    const userMap = new Map(topUsers.map((u) => [u.id, u]));
    const formattedTopConsumers = topConsumersRaw.map((t) => {
      const u = userMap.get(t.userId);
      const used = t._sum.sizeBytes || BigInt(0);
      const quota = u?.storageQuotaBytes || BigInt(0);
      const pct =
        quota > BigInt(0)
          ? Math.min(100, Number((used * BigInt(10000)) / quota) / 100)
          : 0;

      return {
        userId: t.userId,
        name: u ? `${u.firstName} ${u.lastName}` : 'Unknown User',
        email: u?.email || 'N/A',
        totalFiles: t._count.id,
        usedBytes: used.toString(),
        quotaBytes: quota.toString(),
        percentageUsed: pct,
      };
    });

    return {
      totalFiles,
      totalUsers,
      totalStorageUsedBytes: totalStorageUsedBytes.toString(),
      totalQuotaAllocatedBytes: totalQuotaAllocatedBytes.toString(),
      categoryDistribution: formattedCategoryDistribution,
      topConsumers: formattedTopConsumers,
    };
  }

  /**
   * Lists all users with their storage consumption and quota allocations
   */
  static async listUsersStorage(options: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.search) {
      where.OR = [
        { email: { contains: options.search, mode: 'insensitive' } },
        { firstName: { contains: options.search, mode: 'insensitive' } },
        { lastName: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [totalUsers, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          storageQuotaBytes: true,
          createdAt: true,
          _count: {
            select: {
              files: true,
              folders: true,
            },
          },
        },
      }),
    ]);

    // Aggregate storage used per user
    const userIds = users.map((u) => u.id);
    const sums = await prisma.storedFile.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _sum: { sizeBytes: true },
    });

    const sumMap = new Map(sums.map((s) => [s.userId, s._sum.sizeBytes || BigInt(0)]));

    const result = users.map((u) => {
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
        role: u.role,
        status: u.status,
        totalFiles: u._count.files,
        totalFolders: u._count.folders,
        quotaBytes: u.storageQuotaBytes.toString(),
        usedBytes: usedBytes.toString(),
        remainingBytes: remainingBytes.toString(),
        percentageUsed,
        createdAt: u.createdAt,
      };
    });

    return {
      users: result,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    };
  }

  /**
   * Updates a user's storage quota with audit logging
   */
  static async updateUserQuota(
    adminId: string,
    targetUserId: string,
    newQuotaBytes: bigint,
    ipAddress?: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const previousQuotaBytes = user.storageQuotaBytes;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: targetUserId },
        data: { storageQuotaBytes: newQuotaBytes },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          storageQuotaBytes: true,
        },
      });

      // Log in AuditLog
      await tx.auditLog.create({
        data: {
          adminId,
          targetEntity: 'USER',
          targetId: targetUserId,
          action: 'UPDATE_STORAGE_QUOTA',
          previousVal: JSON.stringify({ storageQuotaBytes: previousQuotaBytes.toString() }),
          newVal: JSON.stringify({ storageQuotaBytes: newQuotaBytes.toString() }),
          ipAddress: ipAddress || null,
        },
      });

      return updatedUser;
    });

    return {
      user: {
        ...updated,
        storageQuotaBytes: updated.storageQuotaBytes.toString(),
      },
      previousQuotaBytes: previousQuotaBytes.toString(),
    };
  }

  /**
   * Lists all files across the system with uploader details
   */
  static async listAllFiles(options: {
    search?: string;
    category?: FileCategory;
    userId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.category) {
      where.fileCategory = options.category;
    }
    if (options.search) {
      where.originalName = {
        contains: options.search,
        mode: 'insensitive',
      };
    }

    const [totalFiles, files] = await Promise.all([
      prisma.storedFile.count({ where }),
      prisma.storedFile.findMany({
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
            },
          },
          folder: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const formattedFiles = files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      fileCategory: f.fileCategory,
      sizeBytes: f.sizeBytes.toString(),
      checksumSha256: f.checksumSha256,
      folderId: f.folderId,
      folderName: f.folder?.name || null,
      uploader: {
        id: f.user.id,
        name: `${f.user.firstName} ${f.user.lastName}`,
        email: f.user.email,
      },
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return {
      files: formattedFiles,
      pagination: {
        page,
        limit,
        totalFiles,
        totalPages: Math.ceil(totalFiles / limit),
      },
    };
  }

  /**
   * Administrative deletion of any file with audit logging
   */
  static async adminDeleteFile(adminId: string, fileId: string, ipAddress?: string) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
      include: { user: true },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    // Remove physical ciphertext file via active storage provider
    const storageProvider = getStorageProvider();
    await storageProvider.deleteFile(file.storedName);

    // Delete DB record and log AuditLog in a transaction
    await prisma.$transaction([
      prisma.storedFile.delete({
        where: { id: fileId },
      }),
      prisma.auditLog.create({
        data: {
          adminId,
          targetEntity: 'STORED_FILE',
          targetId: fileId,
          action: 'ADMIN_DELETE_FILE',
          previousVal: JSON.stringify({
            originalName: file.originalName,
            sizeBytes: file.sizeBytes.toString(),
            ownerEmail: file.user.email,
          }),
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return { message: `File '${file.originalName}' deleted by administrator.` };
  }
}
