import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { JwtTokenPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_signing_key_change_in_production_min32chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
export const AUTH_COOKIE_NAME = 'token';

/**
 * Signs a new JWT token with user id, email and role
 */
export const signToken = (payload: JwtTokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as any,
  });
};

/**
 * Verifies a JWT token and returns payload or null
 */
export const verifyToken = (token: string): JwtTokenPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtTokenPayload;
  } catch {
    return null;
  }
};

/**
 * Attaches the JWT token to an HTTP-only cookie with strict security options
 */
export const setAuthCookie = (res: Response, token: string): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS in production
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
};

/**
 * Clears the authentication cookie on logout
 */
export const clearAuthCookie = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/',
  });
};
