import { z } from 'zod';
import { FileCategory } from '@prisma/client';

export const createFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(100, 'Folder name must not exceed 100 characters')
    .regex(/^[^/\\:*?"<>|]+$/, 'Folder name contains illegal characters'),
  parentId: z.string().uuid('Invalid parent folder ID format').optional().nullable(),
});

export const renameFolderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Folder name is required')
    .max(100, 'Folder name must not exceed 100 characters')
    .regex(/^[^/\\:*?"<>|]+$/, 'Folder name contains illegal characters'),
});

export const renameFileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name must not exceed 255 characters')
    .regex(/^[^/\\:*?"<>|]+$/, 'File name contains illegal characters'),
});

export const moveFileSchema = z.object({
  targetFolderId: z.string().uuid('Invalid target folder ID format').optional().nullable(),
});

export const listFilesQuerySchema = z.object({
  folderId: z.string().uuid().optional().nullable(),
  search: z.string().trim().max(100).optional(),
  category: z.nativeEnum(FileCategory).optional(),
  sortBy: z.enum(['name', 'size', 'date']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});
