import { LabCategory, LabDifficulty } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types';

export interface CreateLabInput {
  title: string;
  slug: string;
  description: string;
  category: LabCategory;
  difficulty?: LabDifficulty;
  estimatedMinutes?: number;
}

export interface UpdateLabInput {
  title?: string;
  slug?: string;
  description?: string;
  category?: LabCategory;
  difficulty?: LabDifficulty;
  estimatedMinutes?: number;
  isActive?: boolean;
}

export interface CreateExerciseInput {
  orderIndex: number;
  title: string;
  instruction: string;
  hint?: string;
  expectedCommand?: string;
  expectedOutput?: string;
}

export interface UpdateExerciseInput {
  orderIndex?: number;
  title?: string;
  instruction?: string;
  hint?: string;
  expectedCommand?: string;
  expectedOutput?: string;
}

export class AdminLabService {
  /**
   * Creates a new laboratory
   */
  static async createLab(adminId: string, input: CreateLabInput, ipAddress?: string) {
    const existing = await prisma.lab.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new AppError(`A laboratory with slug '${input.slug}' already exists.`, 409);
    }

    const lab = await prisma.lab.create({
      data: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        category: input.category,
        difficulty: input.difficulty || LabDifficulty.BEGINNER,
        estimatedMinutes: input.estimatedMinutes || 30,
        isActive: true,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'LAB',
        targetId: lab.id,
        action: 'CREATE_LAB',
        newVal: JSON.stringify({ title: lab.title, slug: lab.slug }),
        ipAddress: ipAddress || null,
      },
    });

    return lab;
  }

  /**
   * Updates an existing laboratory
   */
  static async updateLab(adminId: string, labId: string, input: UpdateLabInput, ipAddress?: string) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
    });
    if (!lab) {
      throw new AppError('Laboratory not found.', 404);
    }

    if (input.slug && input.slug !== lab.slug) {
      const existing = await prisma.lab.findUnique({
        where: { slug: input.slug },
      });
      if (existing) {
        throw new AppError(`A laboratory with slug '${input.slug}' already exists.`, 409);
      }
    }

    const updated = await prisma.lab.update({
      where: { id: labId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.slug && { slug: input.slug }),
        ...(input.description && { description: input.description }),
        ...(input.category && { category: input.category }),
        ...(input.difficulty && { difficulty: input.difficulty }),
        ...(input.estimatedMinutes !== undefined && { estimatedMinutes: input.estimatedMinutes }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'LAB',
        targetId: labId,
        action: 'UPDATE_LAB',
        previousVal: JSON.stringify({ title: lab.title, isActive: lab.isActive }),
        newVal: JSON.stringify({ title: updated.title, isActive: updated.isActive }),
        ipAddress: ipAddress || null,
      },
    });

    return updated;
  }

  /**
   * Adds an exercise to a laboratory
   */
  static async createExercise(
    adminId: string,
    labId: string,
    input: CreateExerciseInput,
    ipAddress?: string
  ) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
    });
    if (!lab) {
      throw new AppError('Laboratory not found.', 404);
    }

    const exercise = await prisma.labExercise.create({
      data: {
        labId,
        orderIndex: input.orderIndex,
        title: input.title,
        instruction: input.instruction,
        hint: input.hint || null,
        expectedCommand: input.expectedCommand || null,
        expectedOutput: input.expectedOutput || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'LAB_EXERCISE',
        targetId: exercise.id,
        action: 'CREATE_EXERCISE',
        newVal: JSON.stringify({ title: exercise.title, orderIndex: exercise.orderIndex }),
        ipAddress: ipAddress || null,
      },
    });

    return exercise;
  }

  /**
   * Updates an existing exercise
   */
  static async updateExercise(
    adminId: string,
    exerciseId: string,
    input: UpdateExerciseInput,
    ipAddress?: string
  ) {
    const exercise = await prisma.labExercise.findUnique({
      where: { id: exerciseId },
    });
    if (!exercise) {
      throw new AppError('Lab exercise not found.', 404);
    }

    const updated = await prisma.labExercise.update({
      where: { id: exerciseId },
      data: {
        ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
        ...(input.title && { title: input.title }),
        ...(input.instruction && { instruction: input.instruction }),
        ...(input.hint !== undefined && { hint: input.hint }),
        ...(input.expectedCommand !== undefined && { expectedCommand: input.expectedCommand }),
        ...(input.expectedOutput !== undefined && { expectedOutput: input.expectedOutput }),
      },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'LAB_EXERCISE',
        targetId: exerciseId,
        action: 'UPDATE_EXERCISE',
        previousVal: JSON.stringify({ title: exercise.title }),
        newVal: JSON.stringify({ title: updated.title }),
        ipAddress: ipAddress || null,
      },
    });

    return updated;
  }

  /**
   * Deletes an exercise from a laboratory
   */
  static async deleteExercise(adminId: string, exerciseId: string, ipAddress?: string) {
    const exercise = await prisma.labExercise.findUnique({
      where: { id: exerciseId },
    });
    if (!exercise) {
      throw new AppError('Lab exercise not found.', 404);
    }

    await prisma.labExercise.delete({
      where: { id: exerciseId },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        targetEntity: 'LAB_EXERCISE',
        targetId: exerciseId,
        action: 'DELETE_EXERCISE',
        previousVal: JSON.stringify({ title: exercise.title }),
        ipAddress: ipAddress || null,
      },
    });

    return { message: 'Exercise successfully deleted.' };
  }
}
