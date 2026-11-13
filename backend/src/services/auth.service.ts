import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../types';
import { signToken } from '../utils/jwt.util';
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from '../validators/auth.validator';

const BCRYPT_SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Registers a new student account.
   * STRICT SECURITY: Role is hardcoded to Role.STUDENT. Administrative privileges
   * cannot be claimed via the registration endpoint.
   */
  static async registerStudent(input: RegisterInput, ipAddress?: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new AppError('An account with this email address already exists.', 409);
    }

    if (input.studentId) {
      const existingStudentId = await prisma.userProfile.findUnique({
        where: { studentId: input.studentId },
      });
      if (existingStudentId) {
        throw new AppError('A student profile with this Student ID already exists.', 409);
      }
    }

    // Hash password with strong salt rounds
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const passwordHash = await bcrypt.hash(input.password, salt);

    // Default 100 MB quota for students
    const quotaBytes = BigInt(
      (parseInt(process.env.DEFAULT_USER_QUOTA_MB || '100', 10)) * 1024 * 1024
    );

    // Create user and profile in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: Role.STUDENT, // Strictly forced to STUDENT
          status: UserStatus.ACTIVE,
          storageQuotaBytes: quotaBytes,
          profile: {
            create: {
              studentId: input.studentId || null,
              department: input.department || null,
              semester: input.semester || null,
            },
          },
        },
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

      // Log registration activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: 'STUDENT_REGISTER',
          details: JSON.stringify({ email: user.email, studentId: input.studentId }),
          ipAddress: ipAddress || null,
        },
      });

      return user;
    });

    // Generate JWT token
    const token = signToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    return { user: newUser, token };
  }

  /**
   * Authenticates a user (Student or Admin) and issues a session token
   */
  static async loginUser(input: LoginInput, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        profile: true,
      },
    });

    // Generic error to prevent email enumeration
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401);
    }

    // Verify account active status
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppError(
        `Account access blocked. Current status: ${user.status.toLowerCase()}. Please contact the administrator.`,
        403
      );
    }

    // Update lastLoginAt timestamp & log login activity
    await prisma.$transaction([
      prisma.userProfile.updateMany({
        where: { userId: user.id },
        data: { lastLoginAt: new Date() },
      }),
      prisma.activityLog.create({
        data: {
          userId: user.id,
          action: 'USER_LOGIN',
          details: JSON.stringify({ role: user.role }),
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Strip passwordHash before returning
    const { passwordHash: _hash, ...sanitizedUser } = user;

    return { user: sanitizedUser, token };
  }

  /**
   * Retrieves full profile and dashboard metrics for the authenticated user
   */
  static async getCurrentUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
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
        _count: {
          select: {
            files: true,
            folders: true,
            labSessions: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // Calculate total used storage bytes
    const storageSum = await prisma.storedFile.aggregate({
      where: { userId },
      _sum: { sizeBytes: true },
    });

    const usedStorageBytes = storageSum._sum.sizeBytes || BigInt(0);

    return {
      ...user,
      storageStats: {
        quotaBytes: user.storageQuotaBytes.toString(),
        usedBytes: usedStorageBytes.toString(),
        availableBytes: (user.storageQuotaBytes - usedStorageBytes).toString(),
        totalFiles: user._count.files,
        totalFolders: user._count.folders,
      },
      storageQuotaBytes: user.storageQuotaBytes.toString(),
    };
  }

  /**
   * Updates student/user profile details
   */
  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (input.firstName || input.lastName) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(input.firstName && { firstName: input.firstName }),
            ...(input.lastName && { lastName: input.lastName }),
          },
        });
      }

      await tx.userProfile.upsert({
        where: { userId },
        update: {
          ...(input.department !== undefined && { department: input.department }),
          ...(input.semester !== undefined && { semester: input.semester }),
          ...(input.bio !== undefined && { bio: input.bio }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl || null }),
        },
        create: {
          userId,
          department: input.department || null,
          semester: input.semester || null,
          bio: input.bio || null,
          avatarUrl: input.avatarUrl || null,
        },
      });

      return tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          storageQuotaBytes: true,
          profile: true,
        },
      });
    });

    return updatedUser;
  }

  /**
   * Changes authenticated user password with current password verification
   */
  static async changePassword(userId: string, input: ChangePasswordInput, ipAddress?: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, email: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const isMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password is incorrect.', 400);
    }

    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    const newPasswordHash = await bcrypt.hash(input.newPassword, salt);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.activityLog.create({
        data: {
          userId,
          action: 'PASSWORD_CHANGED',
          details: JSON.stringify({ email: user.email }),
          ipAddress: ipAddress || null,
        },
      }),
    ]);

    return { message: 'Password changed successfully.' };
  }
}
