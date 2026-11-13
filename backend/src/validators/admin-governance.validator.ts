import { z } from 'zod';
import { Role, UserStatus } from '@prisma/client';

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['name', 'email', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus, {
    errorMap: () => ({ message: 'Status must be ACTIVE, INACTIVE, or SUSPENDED.' }),
  }),
});

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(Role, {
    errorMap: () => ({ message: 'Role must be STUDENT or ADMIN.' }),
  }),
});

export const listActivitiesQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  userId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const listAuditLogsQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  targetEntity: z.string().trim().max(50).optional(),
  adminId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const toggleLabStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean flag is required.' }),
});
