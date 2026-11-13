import { Request, Response, NextFunction } from 'express';
import { AdminLabService } from '../services/admin-lab.service';
import { sendResponse } from '../utils/apiResponse';

export class AdminLabController {
  static async createLab(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lab = await AdminLabService.createLab(req.user!.id, req.body, req.ip);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Laboratory created successfully.',
        data: { lab },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLab(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lab = await AdminLabService.updateLab(req.user!.id, req.params.id, req.body, req.ip);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Laboratory updated successfully.',
        data: { lab },
      });
    } catch (error) {
      next(error);
    }
  }

  static async createExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercise = await AdminLabService.createExercise(
        req.user!.id,
        req.params.labId,
        req.body,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 201,
        message: 'Lab exercise created successfully.',
        data: { exercise },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const exercise = await AdminLabService.updateExercise(
        req.user!.id,
        req.params.exerciseId,
        req.body,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'Lab exercise updated successfully.',
        data: { exercise },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteExercise(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminLabService.deleteExercise(
        req.user!.id,
        req.params.exerciseId,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}
