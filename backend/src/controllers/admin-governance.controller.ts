import { Request, Response, NextFunction } from 'express';
import { AdminGovernanceService } from '../services/admin-governance.service';
import { sendResponse } from '../utils/apiResponse';

export class AdminGovernanceController {
  static async getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await AdminGovernanceService.getDashboardMetrics();

      sendResponse({
        res,
        statusCode: 200,
        message: 'System administrative dashboard metrics retrieved successfully.',
        data: { metrics },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, role, status, page, limit, sortBy, sortOrder } = req.query;

      const result = await AdminGovernanceService.listUsers({
        ...(search && { search: String(search) }),
        ...(role && { role: role as any }),
        ...(status && { status: status as any }),
        ...(page && { page: Number(page) }),
        ...(limit && { limit: Number(limit) }),
        ...(sortBy && { sortBy: sortBy as any }),
        ...(sortOrder && { sortOrder: sortOrder as any }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'Users retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const details = await AdminGovernanceService.getUserDetails(req.params.id);

      sendResponse({
        res,
        statusCode: 200,
        message: 'User details and activity record retrieved successfully.',
        data: details,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminGovernanceService.updateUserStatus(
        req.user!.id,
        req.params.id,
        req.body.status,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: `User account status updated to ${result.user.status}.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateUserRole(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminGovernanceService.updateUserRole(
        req.user!.id,
        req.params.id,
        req.body.role,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: `User role updated to ${result.user.role}.`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listActivities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, userId, startDate, endDate, page, limit } = req.query;

      const result = await AdminGovernanceService.listActivities({
        ...(action && { action: String(action) }),
        ...(userId && { userId: String(userId) }),
        ...(startDate && { startDate: new Date(String(startDate)) }),
        ...(endDate && { endDate: new Date(String(endDate)) }),
        ...(page && { page: Number(page) }),
        ...(limit && { limit: Number(limit) }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'System activity logs retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { action, targetEntity, adminId, startDate, endDate, page, limit } = req.query;

      const result = await AdminGovernanceService.listAuditLogs({
        ...(action && { action: String(action) }),
        ...(targetEntity && { targetEntity: String(targetEntity) }),
        ...(adminId && { adminId: String(adminId) }),
        ...(startDate && { startDate: new Date(String(startDate)) }),
        ...(endDate && { endDate: new Date(String(endDate)) }),
        ...(page && { page: Number(page) }),
        ...(limit && { limit: Number(limit) }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'Administrative audit logs retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLabGovernance(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminGovernanceService.getLabGovernanceOverview();

      sendResponse({
        res,
        statusCode: 200,
        message: 'Laboratory governance overview retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLabPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await AdminGovernanceService.getLabStudentPerformance(
        req.params.id,
        page ? Number(page) : 1,
        limit ? Number(limit) : 20
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'Laboratory student performance statistics retrieved successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async toggleLabStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const lab = await AdminGovernanceService.toggleLabStatus(
        req.user!.id,
        req.params.id,
        req.body.isActive,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: `Laboratory status updated to ${lab.isActive ? 'active' : 'inactive'}.`,
        data: { lab },
      });
    } catch (error) {
      next(error);
    }
  }
}
