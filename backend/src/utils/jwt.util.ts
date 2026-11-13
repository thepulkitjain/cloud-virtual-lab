import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { JwtTokenPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_signing_key_change_in_production_min32chars';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
export const AUTH_COOKIE_NAME = 'token';

/**
 * Signs a new JWT token with user id, email, role, and a unique jti identifier
 */
export const signToken = (payload: JwtTokenPayload): string => {
  const tokenPayload = {
    ...payload,
    jti: payload.jti || uuidv4(),
  };
  return jwt.sign(tokenPayload, JWT_SECRET, {
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
 * Helper to determine cookie security and SameSite configuration for production/development
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredSameSite = process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict' | undefined;
  const sameSite: 'none' | 'lax' | 'strict' = configuredSameSite || (isProduction ? 'strict' : 'lax');
  const secure = process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : (isProduction || sameSite === 'none');

  return { sameSite, secure };
};

/**
 * Attaches the JWT token to an HTTP-only cookie with strict security options
 */
export const setAuthCookie = (res: Response, token: string): void => {
  const { sameSite, secure } = getCookieOptions();

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: '/',
  });
};

/**
 * Clears the authentication cookie on logout
 */
export const clearAuthCookie = (res: Response): void => {
  const { sameSite, secure } = getCookieOptions();

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
  });
};
