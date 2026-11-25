import { Request, Response, NextFunction } from 'express';
import { LabService } from '../services/lab.service';
import { sendResponse } from '../utils/apiResponse';
import { LabCategory, LabDifficulty } from '@prisma/client';

export class LabController {
  static async getLabs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category, difficulty, search } = req.query;

      const labs = await LabService.listLabs({
        ...(category && { category: category as LabCategory }),
        ...(difficulty && { difficulty: difficulty as LabDifficulty }),
        ...(search && { search: String(search) }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'Laboratories retrieved successfully.',
        data: { labs },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLab(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lab = await LabService.getLabDetails(req.params.idOrSlug, req.user?.id);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Laboratory details retrieved successfully.',
        data: { lab },
      });
    } catch (error) {
      next(error);
    }
  }

  static async startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await LabService.startSession(req.user!.id, req.params.labId, req.ip);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Virtual lab session initialized successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async executeCommand(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { command, exerciseId, code, language } = req.body;
      const result = await LabService.executeCommand(
        req.user!.id,
        req.params.sessionId,
        command,
        exerciseId,
        code,
        language
      );

      sendResponse({
        res,
        statusCode: 200,
        message: result.exercisePassed ? 'Command executed and exercise passed!' : 'Command executed.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async tabComplete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { line } = req.body;
      const result = await LabService.tabComplete(
        req.user!.id,
        req.params.sessionId,
        line ?? ''
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'Tab completion evaluated successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async submitExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { commandInput, exerciseId } = req.body;
      const result = await LabService.executeCommand(
        req.user!.id,
        req.params.sessionId,
        commandInput,
        exerciseId,
        undefined,
        undefined,
        true
      );

      sendResponse({
        res,
        statusCode: 200,
        message: result.exercisePassed
          ? 'Exercise submitted and verified successfully.'
          : 'Exercise submitted: criteria not yet met.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LabService.endSession(req.user!.id, req.params.sessionId, req.ip);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Lab session ended successfully.',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMySessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await LabService.getMySessions(req.user!.id);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Student lab sessions retrieved successfully.',
        data: { sessions },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await LabService.getSessionDetails(req.user!.id, req.params.sessionId);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Session details retrieved successfully.',
        data: { session },
      });
    } catch (error) {
      next(error);
    }
  }
}
