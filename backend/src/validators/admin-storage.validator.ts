import { z } from 'zod';
import { FileCategory } from '@prisma/client';

export const updateQuotaSchema = z
  .object({
    quotaMb: z.number().int().min(1, 'Quota must be at least 1 MB').max(1048576).optional(),
    quotaBytes: z.string().regex(/^\d+$/, 'Quota bytes must be a valid positive integer').optional(),
  })
  .refine((data) => data.quotaMb !== undefined || data.quotaBytes !== undefined, {
    message: 'Either quotaMb or quotaBytes must be specified.',
  });

export const listAllFilesQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.nativeEnum(FileCategory).optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listUsersStorageQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
