import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendResponse } from '../utils/apiResponse';
import { setAuthCookie, clearAuthCookie, AUTH_COOKIE_NAME } from '../utils/jwt.util';
import { tokenRevocationService } from '../services/redis/token-revocation.service';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await AuthService.registerStudent(req.body, req.ip);

      setAuthCookie(res, token);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Student account registered successfully.',
        data: {
          user: {
            ...user,
            storageQuotaBytes: user.storageQuotaBytes.toString(),
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { user, token } = await AuthService.loginUser(req.body, req.ip);

      setAuthCookie(res, token);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Login successful.',
        data: {
          user: {
            ...user,
            storageQuotaBytes: user.storageQuotaBytes.toString(),
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Extract token to invalidate session in distributed Redis store
      let token = req.cookies?.[AUTH_COOKIE_NAME];
      if (!token && req.headers.authorization?.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (token) {
        await tokenRevocationService.revokeToken(token);
      }

      clearAuthCookie(res);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Successfully logged out.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = await AuthService.getCurrentUser(req.user!.id);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Current user session retrieved successfully.',
        data: { user: currentUser },
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updatedUser = await AuthService.updateProfile(req.user!.id, req.body);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Profile updated successfully.',
        data: {
          user: updatedUser
            ? {
                ...updatedUser,
                storageQuotaBytes: updatedUser.storageQuotaBytes.toString(),
              }
            : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.changePassword(req.user!.id, req.body, req.ip);

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
