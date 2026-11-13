import { Role, UserStatus } from '@prisma/client';

export interface JwtTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  storageQuotaBytes: bigint;
  createdAt: Date;
  updatedAt: Date;
  profile?: {
    id: string;
    studentId: string | null;
    department: string | null;
    semester: number | null;
    avatarUrl: string | null;
    bio: string | null;
    lastLoginAt: Date | null;
  } | null;
}

export class AppError extends Error {
  public statusCode: number;
  public errors?: any;

  constructor(message: string, statusCode = 400, errors?: any) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
