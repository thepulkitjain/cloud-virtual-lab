import Redis, { RedisOptions } from 'ioredis';
import envConfig from '../../config/env.config';

export type RedisConnectionStatus =
  | 'connected'
  | 'ready'
  | 'connecting'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'disabled';

export interface RedisHealth {
  status: 'healthy' | 'degraded' | 'disabled' | 'error';
  connected: boolean;
  statusString: RedisConnectionStatus;
  latencyMs?: number;
  details?: string;
}

/**
 * Centralized Redis Service managing lifecycle, reconnection, health, and distributed operations.
 */
export class RedisService {
  private static instance: RedisService | null = null;
  private client: Redis | null = null;
  private status: RedisConnectionStatus = 'disconnected';
  private connectionError: Error | null = null;
  private isExplicitMock = false;

  private constructor() {
    if (!envConfig.redisEnabled) {
      this.status = 'disabled';
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initializes and connects to the Redis server if enabled.
   */
  public async connect(): Promise<Redis | null> {
    if (!envConfig.redisEnabled) {
      this.status = 'disabled';
      return null;
    }

    if (this.client && (this.status === 'connected' || this.status === 'ready')) {
      return this.client;
    }

    try {
      this.status = 'connecting';

      const options: RedisOptions = {
        host: envConfig.redisHost,
        port: envConfig.redisPort,
        password: envConfig.redisPassword || undefined,
        db: envConfig.redisDb,
        keyPrefix: envConfig.redisKeyPrefix,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 10) {
            console.warn('⚠️ [RedisService] Maximum reconnection attempts reached (10). Pausing retries.');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 150, 3000);
          return delay;
        },
      };

      if (envConfig.redisUrl) {
        this.client = new Redis(envConfig.redisUrl, options);
      } else {
        this.client = new Redis(options);
      }

      this.attachEventListeners(this.client);

      await this.client.connect();
      this.status = 'ready';
      this.connectionError = null;
      console.log(`✅ [RedisService] Connected to Redis at ${envConfig.redisHost}:${envConfig.redisPort}`);
      return this.client;
    } catch (err: any) {
      this.status = 'error';
      this.connectionError = err;
      console.warn(`⚠️ [RedisService] Could not connect to Redis: ${err?.message || err}`);

      if (envConfig.redisRequired) {
        throw new Error(`Critical Redis connection failure in required mode: ${err?.message}`);
      }
      return null;
    }
  }

  /**
   * Attaches connection lifecycle event listeners
   */
  private attachEventListeners(client: Redis): void {
    client.on('connect', () => {
      this.status = 'connected';
      this.connectionError = null;
    });

    client.on('ready', () => {
      this.status = 'ready';
      this.connectionError = null;
    });

    client.on('error', (err: Error) => {
      this.status = 'error';
      this.connectionError = err;
      // Do not crash the application on transient connection drops
    });

    client.on('close', () => {
      if (this.status !== 'disabled') {
        this.status = 'disconnected';
      }
    });

    client.on('reconnecting', () => {
      this.status = 'reconnecting';
    });
  }

  /**
   * Gracefully disconnects the Redis client
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        if (typeof this.client.quit === 'function') {
          await this.client.quit();
        } else if (typeof this.client.disconnect === 'function') {
          this.client.disconnect();
        }
      } catch {
        // Fallback to disconnect if quit fails
        this.client.disconnect();
      } finally {
        this.client = null;
        this.status = envConfig.redisEnabled ? 'disconnected' : 'disabled';
        this.isExplicitMock = false;
      }
    }
  }

  /**
   * Returns current raw Redis client or null
   */
  public getClient(): Redis | null {
    return this.client;
  }

  /**
   * Sets custom/mock Redis client (used for testing or dependency injection)
   */
  public setClient(customClient: any): void {
    this.client = customClient;
    this.status = 'ready';
    this.connectionError = null;
    this.isExplicitMock = true;
  }

  /**
   * Resets client back to default
   */
  public resetClient(): void {
    this.client = null;
    this.status = envConfig.redisEnabled ? 'disconnected' : 'disabled';
    this.connectionError = null;
    this.isExplicitMock = false;
  }

  /**
   * Checks whether Redis is currently available and ready to accept commands
   */
  public isAvailable(): boolean {
    if (this.isExplicitMock && this.client) {
      return true;
    }
    return (
      envConfig.redisEnabled &&
      this.client !== null &&
      (this.status === 'ready' || this.status === 'connected')
    );
  }

  /**
   * Returns the connection status string
   */
  public getStatus(): RedisConnectionStatus {
    return this.status;
  }

  /**
   * Performs an active PING command to verify liveness and latency
   */
  public async ping(): Promise<boolean> {
    if (!this.client || !this.isAvailable()) {
      return false;
    }
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Returns structured health assessment for health check endpoint
   */
  public async getHealth(): Promise<RedisHealth> {
    if (!envConfig.redisEnabled) {
      return {
        status: 'disabled',
        connected: false,
        statusString: 'disabled',
        details: 'Redis integration is explicitly disabled via configuration.',
      };
    }

    if (!this.client) {
      return {
        status: envConfig.redisRequired ? 'error' : 'degraded',
        connected: false,
        statusString: this.status,
        details: this.connectionError?.message || 'Redis client not initialized.',
      };
    }

    try {
      const start = Date.now();
      const pong = await this.client.ping();
      const latencyMs = Date.now() - start;

      if (pong === 'PONG') {
        return {
          status: 'healthy',
          connected: true,
          statusString: 'ready',
          latencyMs,
        };
      }

      return {
        status: 'degraded',
        connected: false,
        statusString: this.status,
        details: `Unexpected ping response: ${pong}`,
      };
    } catch (err: any) {
      return {
        status: envConfig.redisRequired ? 'error' : 'degraded',
        connected: false,
        statusString: 'error',
        details: err?.message || 'Failed to ping Redis.',
      };
    }
  }

  // ============================================================================
  // Safe Distributed Key-Value Helpers (with graceful fail-safe fallbacks)
  // ============================================================================

  public async get(key: string): Promise<string | null> {
    if (!this.isAvailable() || !this.client) {
      return null;
    }
    try {
      return await this.client.get(key);
    } catch (err) {
      console.warn(`[RedisService.get] Failed for key "${key}":`, err);
      return null;
    }
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isAvailable() || !this.client) {
      return;
    }
    try {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      console.warn(`[RedisService.set] Failed for key "${key}":`, err);
    }
  }

  public async del(key: string | string[]): Promise<number> {
    if (!this.isAvailable() || !this.client) {
      return 0;
    }
    try {
      const keys = Array.isArray(key) ? key : [key];
      if (keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (err) {
      console.warn(`[RedisService.del] Failed for key(s):`, err);
      return 0;
    }
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.isAvailable() || !this.client) {
      return false;
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (err) {
      console.warn(`[RedisService.exists] Failed for key "${key}":`, err);
      return false;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.isAvailable() || !this.client) {
      return false;
    }
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (err) {
      console.warn(`[RedisService.expire] Failed for key "${key}":`, err);
      return false;
    }
  }
}

export const redisService = RedisService.getInstance();
