import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileCategory } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types';
import { encryptFileBuffer, decryptFileBuffer } from '../utils/crypto.util';
import { resolveFileCategory } from '../utils/file-category.util';
import { getStorageProvider } from './storage';

export const getStorageUploadDirectory = (): string => {
  const configuredPath = process.env.STORAGE_UPLOAD_PATH || '../storage/uploads';
  const resolved = path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(__dirname, '../../', configuredPath);

  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
};

export interface ListFilesOptions {
  folderId?: string | null;
  search?: string;
  category?: FileCategory;
  sortBy?: 'name' | 'size' | 'date';
  sortOrder?: 'asc' | 'desc';
}

export class StorageService {
  /**
   * Retrieves accurate user storage quota metrics
   */
  static async getStorageQuota(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storageQuotaBytes: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const quotaBytes = user.storageQuotaBytes;

    const storageSum = await prisma.storedFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });

    const totalFiles = await prisma.storedFile.count({ where: { userId } });
    const totalFolders = await prisma.storageFolder.count({ where: { userId } });

    const usedBytes = storageSum._sum.sizeBytes || BigInt(0);
    const remainingBytes = quotaBytes > usedBytes ? quotaBytes - usedBytes : BigInt(0);

    const percentageUsed =
      quotaBytes > BigInt(0)
        ? Math.min(100, Number((usedBytes * BigInt(10000)) / quotaBytes) / 100)
        : 100;

    return {
      quotaBytes: quotaBytes.toString(),
      usedBytes: usedBytes.toString(),
      remainingBytes: remainingBytes.toString(),
      percentageUsed,
      totalFiles,
      totalFolders,
    };
  }

  /**
   * Encrypts and stores an uploaded file with quota enforcement and AES-256-GCM
   */
  static async uploadFile(
    userId: string,
    file: Express.Multer.File,
    folderId?: string | null,
    ipAddress?: string
  ) {
    if (!file || !file.buffer) {
      throw new AppError('No file payload received for upload.', 400);
    }

    // 1. Validate destination folder ownership if folderId is specified
    if (folderId) {
      const folder = await prisma.storageFolder.findUnique({
        where: { id: folderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new AppError('The destination folder does not exist or access is forbidden.', 404);
      }
    }

    const fileSize = BigInt(file.size);
    let writtenStoredName: string | null = null;

    try {
      // 2. Atomic Quota Verification inside a Transaction with Row-Level Locking
      const storedFile = await prisma.$transaction(async (tx) => {
        // Enforce concurrency safety: Lock User row exclusively to prevent race conditions during parallel uploads
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { storageQuotaBytes: true },
        });

        if (!user) {
          throw new AppError('User not found.', 404);
        }

        const sumRes = await tx.storedFile.aggregate({
          where: { userId },
          _sum: { sizeBytes: true },
        });

        const currentUsed = sumRes._sum.sizeBytes || BigInt(0);
        if (currentUsed + fileSize > user.storageQuotaBytes) {
          const availableMb = Number(
            (user.storageQuotaBytes - currentUsed) / BigInt(1024 * 1024)
          );
          throw new AppError(
            `Storage quota exceeded. Available: ${availableMb.toFixed(1)} MB. File requires: ${(Number(fileSize) / (1024 * 1024)).toFixed(1)} MB.`,
            400
          );
        }

        // 3. Encrypt file in memory using AES-256-GCM
        const { encryptedBuffer, ivHex, authTagHex, checksumSha256 } = encryptFileBuffer(file.buffer);

        // 4. Generate random stored filename (UUIDv4) and write ciphertext via storage provider
        const storedName = `${uuidv4()}.enc`;
        const storageProvider = getStorageProvider();
        await storageProvider.saveFile(storedName, encryptedBuffer, {
          mimeType: file.mimetype,
          originalName: file.originalname,
          sizeBytes: fileSize,
        });
        writtenStoredName = storedName; // Mark for rollback if DB fails

        // 5. Categorize file based on extension and MIME type
        const fileCategory = resolveFileCategory(file.originalname, file.mimetype);

        // 6. Record metadata in PostgreSQL
        const created = await tx.storedFile.create({
          data: {
            userId,
            folderId: folderId || null,
            originalName: path.basename(file.originalname.replace(/\\/g, '/')), // Strip any cross-platform path traversal attempts
            storedName,
            mimeType: file.mimetype || 'application/octet-stream',
            fileCategory,
            sizeBytes: fileSize,
            encryptionIv: ivHex,
            authTag: authTagHex,
            checksumSha256,
          },
        });

        // 7. Record activity log
        await tx.activityLog.create({
          data: {
            userId,
            action: 'FILE_UPLOAD',
            details: JSON.stringify({
              fileId: created.id,
              fileName: created.originalName,
              sizeBytes: created.sizeBytes.toString(),
              category: created.fileCategory,
            }),
            ipAddress: ipAddress || null,
          },
        });

        return created;
      });

      return {
        id: storedFile.id,
        originalName: storedFile.originalName,
        mimeType: storedFile.mimeType,
        fileCategory: storedFile.fileCategory,
        sizeBytes: storedFile.sizeBytes.toString(),
        folderId: storedFile.folderId,
        checksumSha256: storedFile.checksumSha256,
        createdAt: storedFile.createdAt,
        updatedAt: storedFile.updatedAt,
      };
    } catch (error) {
      // Safe Cleanup: If transaction failed after writing ciphertext, remove orphaned file from storage provider
      if (writtenStoredName) {
        try {
          const storageProvider = getStorageProvider();
          await storageProvider.deleteFile(writtenStoredName);
        } catch (unlinkErr) {
          console.error('Failed to clean up file after failed upload transaction:', unlinkErr);
        }
      }
      throw error;
    }
  }

  /**
   * Lists uploaded files for a user with folder filtering, search, and sorting
   */
  static async listFiles(userId: string, options: ListFilesOptions = {}) {
    const where: any = { userId };

    if (options.folderId !== undefined) {
      where.folderId = options.folderId;
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

    const orderBy: any = {};
    const sortOrder = options.sortOrder === 'asc' ? 'asc' : 'desc';

    if (options.sortBy === 'name') {
      orderBy.originalName = sortOrder;
    } else if (options.sortBy === 'size') {
      orderBy.sizeBytes = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const files = await prisma.storedFile.findMany({
      where,
      orderBy,
      select: {
        id: true,
        folderId: true,
        originalName: true,
        mimeType: true,
        fileCategory: true,
        sizeBytes: true,
        checksumSha256: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return files.map((f) => ({
      ...f,
      sizeBytes: f.sizeBytes.toString(),
    }));
  }

  /**
   * Retrieves single file metadata with ownership verification
   */
  static async getFileDetails(userId: string, fileId: string, isAdmin = false) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
      include: {
        folder: {
          select: { id: true, name: true },
        },
      },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    if (file.userId !== userId && !isAdmin) {
      throw new AppError('Forbidden: You are not authorized to view this file.', 403);
    }

    return {
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      fileCategory: file.fileCategory,
      sizeBytes: file.sizeBytes.toString(),
      folderId: file.folderId,
      folderName: file.folder?.name || null,
      checksumSha256: file.checksumSha256,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  /**
   * Decrypts and streams an authenticated file download
   */
  static async downloadFile(userId: string, fileId: string, isAdmin = false) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    if (file.userId !== userId && !isAdmin) {
      throw new AppError('Forbidden: You are not authorized to download this file.', 403);
    }

    const storageProvider = getStorageProvider();
    const encryptedBuffer = await storageProvider.getFile(file.storedName);

    // Decrypt and verify authenticated GCM tag
    const decryptedBuffer = decryptFileBuffer(
      encryptedBuffer,
      file.encryptionIv,
      file.authTag
    );

    return {
      decryptedBuffer,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      checksumSha256: file.checksumSha256,
    };
  }

  /**
   * Renames an existing file
   */
  static async renameFile(userId: string, fileId: string, newName: string) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    if (file.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to modify this file.', 403);
    }

    const cleanName = path.basename(newName.trim().replace(/\\/g, '/'));
    if (!cleanName) {
      throw new AppError('A valid file name must be provided.', 400);
    }

    const updated = await prisma.storedFile.update({
      where: { id: fileId },
      data: { originalName: cleanName },
    });

    return {
      id: updated.id,
      originalName: updated.originalName,
      sizeBytes: updated.sizeBytes.toString(),
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Moves a file to another folder or root
   */
  static async moveFile(userId: string, fileId: string, targetFolderId: string | null) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    if (file.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to move this file.', 403);
    }

    if (targetFolderId) {
      const folder = await prisma.storageFolder.findUnique({
        where: { id: targetFolderId },
      });
      if (!folder || folder.userId !== userId) {
        throw new AppError('Target destination folder does not exist or access is forbidden.', 404);
      }
    }

    const updated = await prisma.storedFile.update({
      where: { id: fileId },
      data: { folderId: targetFolderId || null },
    });

    return {
      id: updated.id,
      originalName: updated.originalName,
      folderId: updated.folderId,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Permanently deletes a file and its encrypted ciphertext from disk
   */
  static async deleteFile(userId: string, fileId: string, isAdmin = false, ipAddress?: string) {
    const file = await prisma.storedFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new AppError('File not found.', 404);
    }

    if (file.userId !== userId && !isAdmin) {
      throw new AppError('Forbidden: You are not authorized to delete this file.', 403);
    }

    // 1. Remove encrypted file blob via active storage provider
    const storageProvider = getStorageProvider();
    await storageProvider.deleteFile(file.storedName);

    // 2. Remove record from database & log activity
    await prisma.$transaction([
      prisma.storedFile.delete({
        where: { id: fileId },
      }),
      prisma.activityLog.create({
        data: {
          userId,
          action: 'FILE_DELETE',
          details: JSON.stringify({ fileId, fileName: file.originalName }),
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return { message: 'File permanently deleted.' };
  }

  // ==========================================
  // Folder Operations
  // ==========================================

  /**
   * Creates a new storage folder
   */
  static async createFolder(userId: string, name: string, parentId?: string | null) {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new AppError('Folder name is required.', 400);
    }

    if (parentId) {
      const parent = await prisma.storageFolder.findUnique({
        where: { id: parentId },
      });
      if (!parent || parent.userId !== userId) {
        throw new AppError('Parent folder does not exist or access is forbidden.', 404);
      }
    }

    const existing = await prisma.storageFolder.findFirst({
      where: {
        userId,
        parentId: parentId || null,
        name: cleanName,
      },
    });

    if (existing) {
      throw new AppError(`A folder named '${cleanName}' already exists in this location.`, 409);
    }

    const folder = await prisma.storageFolder.create({
      data: {
        userId,
        name: cleanName,
        parentId: parentId || null,
      },
    });

    return folder;
  }

  /**
   * Lists folders for a user
   */
  static async listFolders(userId: string, parentId?: string | null) {
    const where: any = { userId };
    if (parentId !== undefined) {
      where.parentId = parentId;
    }

    const folders = await prisma.storageFolder.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      parentId: f.parentId,
      fileCount: f._count.files,
      subfolderCount: f._count.children,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  /**
   * Renames a folder
   */
  static async renameFolder(userId: string, folderId: string, newName: string) {
    const folder = await prisma.storageFolder.findUnique({
      where: { id: folderId },
    });

    if (!folder) {
      throw new AppError('Folder not found.', 404);
    }

    if (folder.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to modify this folder.', 403);
    }

    const cleanName = newName.trim();
    if (!cleanName) {
      throw new AppError('Folder name cannot be empty.', 400);
    }

    const existing = await prisma.storageFolder.findFirst({
      where: {
        userId,
        parentId: folder.parentId,
        name: cleanName,
        NOT: { id: folderId },
      },
    });

    if (existing) {
      throw new AppError(`A folder named '${cleanName}' already exists in this directory.`, 409);
    }

    const updated = await prisma.storageFolder.update({
      where: { id: folderId },
      data: { name: cleanName },
    });

    return updated;
  }

  /**
   * Deletes an empty folder (Prevents accidental loss of files)
   */
  static async deleteFolder(userId: string, folderId: string) {
    const folder = await prisma.storageFolder.findUnique({
      where: { id: folderId },
      include: {
        _count: {
          select: {
            files: true,
            children: true,
          },
        },
      },
    });

    if (!folder) {
      throw new AppError('Folder not found.', 404);
    }

    if (folder.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to delete this folder.', 403);
    }

    if (folder._count.files > 0 || folder._count.children > 0) {
      throw new AppError(
        'Cannot delete folder: Folder is not empty. Please delete or move all contained files and subfolders first.',
        400
      );
    }

    await prisma.storageFolder.delete({
      where: { id: folderId },
    });

    return { message: 'Folder successfully deleted.' };
  }
}
