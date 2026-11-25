import { LabCategory, LabDifficulty, SessionStatus, SubmissionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types';
import { LabSimulatorService, SimulatorExecutionResult } from './lab-simulator.service';
import { TabCompletionResult } from './simulators/linux.simulator';

export interface LabFilters {
  category?: LabCategory;
  difficulty?: LabDifficulty;
  search?: string;
}

export class LabService {
  /**
   * Retrieves all available laboratories with exercise counts and metadata
   */
  static async listLabs(filters: LabFilters = {}) {
    const where: any = { isActive: true };

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.difficulty) {
      where.difficulty = filters.difficulty;
    }
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const labs = await prisma.lab.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            exercises: true,
            sessions: true,
          },
        },
      },
    });

    return labs.map((l) => ({
      id: l.id,
      title: l.title,
      slug: l.slug,
      description: l.description,
      category: l.category,
      difficulty: l.difficulty,
      estimatedMinutes: l.estimatedMinutes,
      exerciseCount: l._count.exercises,
      totalSessions: l._count.sessions,
      createdAt: l.createdAt,
    }));
  }

  /**
   * Retrieves single laboratory details along with exercises
   */
  static async getLabDetails(idOrSlug: string, userId?: string) {
    const lab = await prisma.lab.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
      include: {
        exercises: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            orderIndex: true,
            title: true,
            instruction: true,
            hint: true,
            expectedCommand: true,
            expectedOutput: true,
          },
        },
      },
    });

    if (!lab) {
      throw new AppError('Laboratory not found.', 404);
    }

    // Check if authenticated user has an active or recent session for this lab
    let activeSession = null;
    if (userId) {
      activeSession = await prisma.labSession.findFirst({
        where: {
          userId,
          labId: lab.id,
          status: SessionStatus.IN_PROGRESS,
        },
        include: {
          submissions: {
            select: {
              exerciseId: true,
              status: true,
              submittedAt: true,
            },
          },
        },
      });
    }

    return {
      ...lab,
      activeSession,
    };
  }

  /**
   * Starts a new virtual lab session for the student
   */
  static async startSession(userId: string, labId: string, ipAddress?: string) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      include: { exercises: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!lab || !lab.isActive) {
      throw new AppError('The requested laboratory is currently unavailable.', 404);
    }

    // Resume existing IN_PROGRESS session if one exists
    let session = await prisma.labSession.findFirst({
      where: {
        userId,
        labId: lab.id,
        status: SessionStatus.IN_PROGRESS,
      },
      include: {
        submissions: true,
      },
    });

    if (!session) {
      session = await prisma.labSession.create({
        data: {
          userId,
          labId: lab.id,
          status: SessionStatus.IN_PROGRESS,
          score: 0,
        },
        include: {
          submissions: true,
        },
      });

      // Log session start activity
      await prisma.activityLog.create({
        data: {
          userId,
          sessionId: session.id,
          action: 'LAB_SESSION_STARTED',
          details: JSON.stringify({ labTitle: lab.title, category: lab.category }),
          ipAddress: ipAddress || null,
        },
      });
    }

    return {
      session,
      lab: {
        id: lab.id,
        title: lab.title,
        category: lab.category,
        difficulty: lab.difficulty,
        exercises: lab.exercises,
      },
    };
  }

  /**
   * Verifies that a lab session exists, belongs to the requesting user, and is IN_PROGRESS.
   */
  private static async getVerifiedActiveSession(userId: string, sessionId: string) {
    const session = await prisma.labSession.findUnique({
      where: { id: sessionId },
      include: {
        lab: {
          include: {
            exercises: true,
          },
        },
      },
    });

    if (!session) {
      throw new AppError('Lab session not found.', 404);
    }

    if (session.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to access this session.', 403);
    }

    if (session.status !== SessionStatus.IN_PROGRESS) {
      throw new AppError('This lab session is already closed.', 400);
    }

    return session;
  }

  /**
   * Executes a command inside the simulated lab environment
   */
  static async executeCommand(
    userId: string,
    sessionId: string,
    command: string,
    exerciseId?: string,
    code?: string,
    language?: 'python' | 'javascript',
    recordFailure = false
  ): Promise<SimulatorExecutionResult & { submission?: any; currentScore: number }> {
    const session = await this.getVerifiedActiveSession(userId, sessionId);

    // Determine criteria if an exerciseId is specified
    let targetExercise = null;
    if (exerciseId) {
      targetExercise = session.lab.exercises.find((e) => e.id === exerciseId);
    }

    // Dispatch to simulator
    const simResult = await LabSimulatorService.execute(
      session.id,
      session.lab.category,
      command,
      targetExercise ? {
        expectedCommand: targetExercise.expectedCommand,
        expectedOutput: targetExercise.expectedOutput,
      } : undefined,
      code !== undefined || language !== undefined ? { code, language } : undefined
    );

    let submissionRecord = null;
    let newScore = session.score;

    if (targetExercise && simResult.exercisePassed) {
      // Upsert submission
      submissionRecord = await prisma.exerciseSubmission.create({
        data: {
          sessionId: session.id,
          userId,
          exerciseId: targetExercise.id,
          commandInput: command,
          outputResult: simResult.output,
          status: SubmissionStatus.PASSED,
        },
      });

      // Recalculate score based on passed distinct exercises
      const passedCount = await prisma.exerciseSubmission.groupBy({
        by: ['exerciseId'],
        where: {
          sessionId: session.id,
          status: SubmissionStatus.PASSED,
        },
      });

      const totalExercises = session.lab.exercises.length;
      newScore = totalExercises > 0 ? Math.round((passedCount.length / totalExercises) * 100) : 100;

      await prisma.labSession.update({
        where: { id: session.id },
        data: { score: newScore },
      });
    } else if (targetExercise && recordFailure && !simResult.exercisePassed) {
      submissionRecord = await prisma.exerciseSubmission.create({
        data: {
          sessionId: session.id,
          userId,
          exerciseId: targetExercise.id,
          commandInput: command,
          outputResult: simResult.output,
          status: SubmissionStatus.FAILED,
        },
      });
      simResult.feedbackMessage =
        'Submission did not meet exercise criteria. Review your command or output and try again.';
    }

    return {
      ...simResult,
      submission: submissionRecord,
      currentScore: newScore,
    };
  }

  /**
   * Generates tab autocomplete suggestions for active session
   */
  static async tabComplete(
    userId: string,
    sessionId: string,
    commandLine: string
  ): Promise<TabCompletionResult> {
    const session = await this.getVerifiedActiveSession(userId, sessionId);
    return LabSimulatorService.tabComplete(session.id, session.lab.category, commandLine);
  }

  /**
   * Completes and ends a lab session
   */
  static async endSession(userId: string, sessionId: string, ipAddress?: string) {
    const session = await prisma.labSession.findUnique({
      where: { id: sessionId },
      include: {
        lab: true,
        submissions: true,
      },
    });

    if (!session) {
      throw new AppError('Lab session not found.', 404);
    }

    if (session.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to end this session.', 403);
    }

    const updatedSession = await prisma.labSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        endedAt: new Date(),
      },
    });

    // Cleanup Redis & in-memory simulator data
    await LabSimulatorService.destroySession(sessionId);

    // Log completion
    await prisma.activityLog.create({
      data: {
        userId,
        sessionId: session.id,
        action: 'LAB_SESSION_COMPLETED',
        details: JSON.stringify({ score: updatedSession.score, labTitle: session.lab.title }),
        ipAddress: ipAddress || null,
      },
    });

    return updatedSession;
  }

  /**
   * Retrieves list of sessions for the logged-in student
   */
  static async getMySessions(userId: string) {
    return prisma.labSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        lab: {
          select: {
            id: true,
            title: true,
            category: true,
            difficulty: true,
          },
        },
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves full session details with all exercise submissions
   */
  static async getSessionDetails(userId: string, sessionId: string) {
    const session = await prisma.labSession.findUnique({
      where: { id: sessionId },
      include: {
        lab: {
          include: {
            exercises: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!session) {
      throw new AppError('Session not found.', 404);
    }

    if (session.userId !== userId) {
      throw new AppError('Forbidden: You are not authorized to access this session.', 403);
    }

    return session;
  }
}
