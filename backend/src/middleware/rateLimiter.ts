import rateLimit, {
  Store,
  Options as RateLimitOptions,
  IncrementResponse,
  MemoryStore,
} from 'express-rate-limit';
import { redisService } from '../services/redis/redis.service';
import envConfig from '../config/env.config';

/**
 * Resilient distributed rate limit store that executes atomic Redis commands
 * (INCR, PEXPIRE, PTTL, DECR, DEL) when Redis is available, ensuring synchronized
 * rate-limit enforcement across multiple backend instances, and gracefully falls
 * back to MemoryStore if Redis is offline or disabled.
 */
export class ResilientRateLimitStore implements Store {
  private memoryStore: MemoryStore;
  public prefix: string;
  private windowMs: number = 60 * 1000;

  constructor(prefix: string) {
    this.prefix = prefix;
    this.memoryStore = new MemoryStore();
  }

  public init(options: RateLimitOptions): void {
    this.windowMs = options.windowMs;
    this.memoryStore.init(options);
  }

  public async increment(key: string): Promise<IncrementResponse> {
    if (redisService.isAvailable()) {
      try {
        const client = redisService.getClient();
        if (client) {
          const fullKey = `cvl:rl:${this.prefix}:${key}`;
          const totalHits = await client.incr(fullKey);

          if (totalHits === 1) {
            await client.pexpire(fullKey, this.windowMs);
          }

          let pttl = await client.pttl(fullKey);
          if (pttl <= 0) {
            await client.pexpire(fullKey, this.windowMs);
            pttl = this.windowMs;
          }

          const resetTime = new Date(Date.now() + pttl);
          return { totalHits, resetTime };
        }
      } catch (err) {
        console.warn(`⚠️ [RateLimitStore] Redis increment error for key "${key}", falling back to memory store:`, err);
        if (envConfig.redisRequired) {
          throw err;
        }
      }
    }

    return this.memoryStore.increment(key);
  }

  public async decrement(key: string): Promise<void> {
    if (redisService.isAvailable()) {
      try {
        const client = redisService.getClient();
        if (client) {
          const fullKey = `cvl:rl:${this.prefix}:${key}`;
          await client.decr(fullKey);
          return;
        }
      } catch {
        // Fallback to memory
      }
    }
    await this.memoryStore.decrement(key);
  }

  public async resetKey(key: string): Promise<void> {
    if (redisService.isAvailable()) {
      try {
        const client = redisService.getClient();
        if (client) {
          const fullKey = `cvl:rl:${this.prefix}:${key}`;
          await client.del(fullKey);
          return;
        }
      } catch {
        // Fallback to memory
      }
    }
    await this.memoryStore.resetKey(key);
  }

  public async resetAll(): Promise<void> {
    if (typeof (this.memoryStore as any).resetAll === 'function') {
      await (this.memoryStore as any).resetAll();
    }
  }

  public getPrefix(): string {
    return this.prefix;
  }
}

/**
 * Factory for creating distributed rate limiters with custom window, limits, and redis prefix
 */
export const createDistributedRateLimiter = (options: {
  windowMs: number;
  max: number | ((req: any) => number | Promise<number>);
  prefix: string;
  message: string;
}) => {
  const store = new ResilientRateLimitStore(options.prefix);

  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: true,
    store,
    message: {
      success: false,
      message: options.message,
    },
  });
};

/**
 * Distributed rate limiter for sensitive authentication endpoints (login, registration)
 * 20 attempts per 15-minute window in production, 1000 in test mode.
 * Enforced consistently across all backend instances via Redis.
 */
export const authLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20,
  prefix: 'auth',
  message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
});

const getTestAwareMax = (prodDefault: number) => () => {
  if (process.env.NODE_ENV === 'test') {
    const override = parseInt(process.env.TEST_RATE_LIMIT_MAX || '', 10);
    if (Number.isFinite(override) && override > 0) return override;
    return 1000;
  }
  return prodDefault;
};

/**
 * Distributed rate limiter for encrypted storage upload/download operations
 */
export const storageLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getTestAwareMax(120),
  prefix: 'storage',
  message: 'Too many storage transfer requests from this IP. Please try again after 15 minutes.',
});

/**
 * Distributed rate limiter for password change attempts
 */
export const passwordChangeLimiter = createDistributedRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: getTestAwareMax(10),
  prefix: 'password-change',
  message: 'Too many password change attempts from this IP. Please try again after 15 minutes.',
});
