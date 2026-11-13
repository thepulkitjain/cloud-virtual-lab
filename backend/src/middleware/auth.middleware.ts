import { Request, Response, NextFunction } from 'express';
import { UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AUTH_COOKIE_NAME, verifyToken } from '../utils/jwt.util';
import { tokenRevocationService } from '../services/redis/token-revocation.service';
import { AppError, AuthUser } from '../types';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Extract token from HTTP-only cookie or Bearer Authorization header
    let token = req.cookies?.[AUTH_COOKIE_NAME];

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new AppError('Authentication required. Please log in to continue.', 401);
    }

    // 2. Verify token signature
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      throw new AppError('Invalid or expired authentication session. Please log in again.', 401);
    }

    // 3. Verify token revocation status in distributed Redis store
    const isRevoked = await tokenRevocationService.isTokenRevoked(token, payload);
    if (isRevoked) {
      throw new AppError('Authentication session has been revoked. Please log in again.', 401);
    }

    // 4. Verify user in database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        storageQuotaBytes: true,
        createdAt: true,
        updatedAt: true,
        profile: {
          select: {
            id: true,
            studentId: true,
            department: true,
            semester: true,
            avatarUrl: true,
            bio: true,
            lastLoginAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User account associated with this session no longer exists.', 401);
    }

    // 4. Verify account active status
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError(
        `Account access blocked. Current status: ${user.status.toLowerCase()}. Please contact the administrator.`,
        403
      );
    }

    // 5. Attach authenticated user to request context
    req.user = user as AuthUser;
    next();
  } catch (error) {
    next(error);
  }
};
