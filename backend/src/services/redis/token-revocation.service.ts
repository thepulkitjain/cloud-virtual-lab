import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { redisService } from './redis.service';
import envConfig from '../../config/env.config';

export interface DecodedJwtToken {
  userId?: string;
  email?: string;
  role?: string;
  jti?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Service managing JWT session revocation with Redis-backed distributed storage
 * and automatic TTL-based expiration. Also includes in-memory fallback for fail-safe
 * resilience when Redis is temporarily offline.
 */
export class TokenRevocationService {
  private static instance: TokenRevocationService | null = null;

  // In-memory fallback caches for environments without active Redis
  private inMemoryRevokedTokens = new Map<string, number>(); // tokenHash -> expiry timestamp (ms)
  private inMemoryRevokedUsers = new Map<string, number>(); // userId -> revocation timestamp (sec)

  private constructor() {
    // Periodic sweep for in-memory expired records (every 10 minutes)
    setInterval(() => this.cleanupExpiredInMemory(), 10 * 60 * 1000).unref();
  }

  public static getInstance(): TokenRevocationService {
    if (!TokenRevocationService.instance) {
      TokenRevocationService.instance = new TokenRevocationService();
    }
    return TokenRevocationService.instance;
  }

  /**
   * Hashes a JWT token using SHA-256 to avoid storing sensitive signatures or secrets
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Extracts decoded payload from a JWT token without requiring signature verification
   */
  private decodeTokenSafely(token: string): DecodedJwtToken | null {
    try {
      const decoded = jwt.decode(token);
      if (decoded && typeof decoded === 'object') {
        return decoded as DecodedJwtToken;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Revokes an individual JWT token (e.g., upon user logout)
   */
  public async revokeToken(token: string): Promise<boolean> {
    if (!token) return false;

    const tokenHash = this.hashToken(token);
    const decoded = this.decodeTokenSafely(token);

    // Calculate remaining TTL in seconds
    const nowSeconds = Math.floor(Date.now() / 1000);
    const expSeconds = decoded?.exp || nowSeconds + 24 * 3600; // fallback to 24h
    const remainingSeconds = Math.max(1, expSeconds - nowSeconds);

    // 1. Store in Redis if available
    if (redisService.isAvailable()) {
      await redisService.set(
        `revoked_token:${tokenHash}`,
        JSON.stringify({
          userId: decoded?.userId || null,
          revokedAt: nowSeconds,
        }),
        remainingSeconds
      );

      // If token contains a jti claim, also revoke by jti
      if (decoded?.jti) {
        await redisService.set(`revoked_jti:${decoded.jti}`, '1', remainingSeconds);
      }
    }

    // 2. Always store in memory fallback cache
    const expiryMs = Date.now() + remainingSeconds * 1000;
    this.inMemoryRevokedTokens.set(tokenHash, expiryMs);
    if (decoded?.jti) {
      this.inMemoryRevokedTokens.set(`jti:${decoded.jti}`, expiryMs);
    }

    return true;
  }

  /**
   * Revokes all active sessions for a specific user (e.g., account suspension, password change)
   */
  public async revokeAllUserTokens(userId: string): Promise<boolean> {
    if (!userId) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const maxTtlSeconds = 24 * 3600; // 24 hours (max token lifetime)

    // 1. Store in Redis if available
    if (redisService.isAvailable()) {
      await redisService.set(
        `user_revoked:${userId}`,
        nowSeconds.toString(),
        maxTtlSeconds
      );
    }

    // 2. Always store in memory fallback cache
    this.inMemoryRevokedUsers.set(userId, nowSeconds);

    return true;
  }

  /**
   * Clears user revocation record (e.g., when an administrator reactivates a suspended user)
   */
  public async clearUserRevocation(userId: string): Promise<boolean> {
    if (!userId) return false;

    if (redisService.isAvailable()) {
      await redisService.del(`user_revoked:${userId}`);
    }

    this.inMemoryRevokedUsers.delete(userId);
    return true;
  }

  /**
   * Checks whether a token has been revoked (either individually or via user-wide session invalidation)
   */
  public async isTokenRevoked(token: string, preDecodedPayload?: DecodedJwtToken): Promise<boolean> {
    if (!token) return true;

    const tokenHash = this.hashToken(token);
    const decoded = preDecodedPayload || this.decodeTokenSafely(token);

    // Check Redis when available
    if (redisService.isAvailable()) {
      try {
        // 1. Check if individual token was revoked
        const isIndividuallyRevoked = await redisService.exists(`revoked_token:${tokenHash}`);
        if (isIndividuallyRevoked) {
          return true;
        }

        // 2. Check if jti was revoked
        if (decoded?.jti) {
          const isJtiRevoked = await redisService.exists(`revoked_jti:${decoded.jti}`);
          if (isJtiRevoked) {
            return true;
          }
        }

        // 3. Check if user-level sessions were invalidated after this token was issued
        if (decoded?.userId) {
          const userRevokedTimestampStr = await redisService.get(`user_revoked:${decoded.userId}`);
          if (userRevokedTimestampStr) {
            const userRevokedTimestamp = parseInt(userRevokedTimestampStr, 10);
            const tokenIssuedAt = decoded.iat || 0;

            // If revocation happened at or after token issuance, the token is invalid
            if (userRevokedTimestamp >= tokenIssuedAt) {
              return true;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ [TokenRevocationService] Error checking Redis revocation status:', err);

        // If Redis is strictly required in production, fail closed
        if (envConfig.redisRequired) {
          throw err;
        }
      }
    }

    // Check In-Memory Fallback Cache
    const tokenExpiry = this.inMemoryRevokedTokens.get(tokenHash);
    if (tokenExpiry && tokenExpiry > Date.now()) {
      return true;
    }

    if (decoded?.jti) {
      const jtiExpiry = this.inMemoryRevokedTokens.get(`jti:${decoded.jti}`);
      if (jtiExpiry && jtiExpiry > Date.now()) {
        return true;
      }
    }

    if (decoded?.userId) {
      const userRevocationTimestamp = this.inMemoryRevokedUsers.get(decoded.userId);
      if (userRevocationTimestamp) {
        const tokenIssuedAt = decoded.iat || 0;
        if (userRevocationTimestamp >= tokenIssuedAt) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Cleans up expired records from the in-memory fallback cache
   */
  private cleanupExpiredInMemory(): void {
    const now = Date.now();
    for (const [key, expiry] of this.inMemoryRevokedTokens.entries()) {
      if (expiry <= now) {
        this.inMemoryRevokedTokens.delete(key);
      }
    }
  }

  /**
   * Resets local in-memory state (useful for test isolation)
   */
  public clearLocalCache(): void {
    this.inMemoryRevokedTokens.clear();
    this.inMemoryRevokedUsers.clear();
  }
}

export const tokenRevocationService = TokenRevocationService.getInstance();
