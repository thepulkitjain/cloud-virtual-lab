import { Request, Response, NextFunction } from 'express';
import { AdminStorageService } from '../services/admin-storage.service';
import { sendResponse } from '../utils/apiResponse';

export class AdminStorageController {
  static async getOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await AdminStorageService.getStorageOverview();

      sendResponse({
        res,
        statusCode: 200,
        message: 'Administrative storage overview retrieved successfully.',
        data: { overview },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUsersStorage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, page, limit } = req.query;
      const data = await AdminStorageService.listUsersStorage({
        ...(search && { search: String(search) }),
        ...(page && { page: Number(page) }),
        ...(limit && { limit: Number(limit) }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'User storage allocations retrieved successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { quotaMb, quotaBytes } = req.body;

      const bytes = quotaBytes
        ? BigInt(quotaBytes)
        : BigInt(quotaMb) * BigInt(1024 * 1024);

      const result = await AdminStorageService.updateUserQuota(
        req.user!.id,
        userId,
        bytes,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'User storage quota updated successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAllFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, category, userId, page, limit } = req.query;
      const data = await AdminStorageService.listAllFiles({
        ...(search && { search: String(search) }),
        ...(category && { category: category as any }),
        ...(userId && { userId: String(userId) }),
        ...(page && { page: Number(page) }),
        ...(limit && { limit: Number(limit) }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'System files retrieved successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await AdminStorageService.adminDeleteFile(req.user!.id, id, req.ip);

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
