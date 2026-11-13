import { z } from 'zod';
import { LabCategory, LabDifficulty } from '@prisma/client';

export const executeCommandSchema = z.object({
  command: z
    .string()
    .trim()
    .min(1, 'Command cannot be empty')
    .max(2000, 'Command exceeds maximum length limit'),
  exerciseId: z.string().uuid('Invalid exercise ID format').optional(),
});

export const submitExerciseSchema = z.object({
  exerciseId: z.string().uuid('Invalid exercise ID format'),
  commandInput: z
    .string()
    .trim()
    .min(1, 'Submitted command or code cannot be empty')
    .max(5000, 'Code submission exceeds maximum length limit'),
});

export const createLabSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  category: z.nativeEnum(LabCategory, {
    errorMap: () => ({ message: 'Category must be LINUX, NETWORKING, PROGRAMMING, or DATABASE' }),
  }),
  difficulty: z.nativeEnum(LabDifficulty).optional(),
  estimatedMinutes: z.number().int().min(5).max(300).optional(),
});

export const updateLabSchema = createLabSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createExerciseSchema = z.object({
  orderIndex: z.number().int().min(1, 'Order index must be at least 1'),
  title: z.string().trim().min(3).max(200),
  instruction: z.string().trim().min(5, 'Instruction must be at least 5 characters'),
  hint: z.string().trim().max(500).optional(),
  expectedCommand: z.string().trim().max(500).optional(),
  expectedOutput: z.string().trim().max(1000).optional(),
});

export const updateExerciseSchema = createExerciseSchema.partial();
