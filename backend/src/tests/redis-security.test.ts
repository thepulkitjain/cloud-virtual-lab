import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import RedisMock from 'ioredis-mock';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { redisService } from '../services/redis/redis.service';
import { tokenRevocationService } from '../services/redis/token-revocation.service';
import {
  ResilientRateLimitStore,
  createDistributedRateLimiter,
} from '../middleware/rateLimiter';
import { authenticate } from '../middleware/auth.middleware';
import { signToken, AUTH_COOKIE_NAME } from '../utils/jwt.util';
import { AdminGovernanceService } from '../services/admin-governance.service';
import { createApp } from '../app';

describe('Phase 9C: Redis Integration & Distributed Security Tests', () => {
  let mockRedis: any;

  beforeAll(async () => {
    // Setup isolated in-memory Redis client for predictable test assertions
    mockRedis = new RedisMock();
    redisService.setClient(mockRedis);
  });

  afterAll(async () => {
    await redisService.disconnect();
    redisService.resetClient();
  });

  beforeEach(async () => {
    tokenRevocationService.clearLocalCache();
    if (mockRedis && typeof mockRedis.flushall === 'function') {
      await mockRedis.flushall();
    }
  });

  // ============================================================================
  // MODULE 1: Redis Connection Lifecycle & Health Monitoring
  // ============================================================================
  describe('1. Redis Lifecycle & Health Monitoring', () => {
    it('should report healthy status and active connection when Redis is available', async () => {
      const health = await redisService.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.connected).toBe(true);
      expect(health.statusString).toBe('ready');
      expect(typeof health.latencyMs).toBe('number');
    });

    it('should successfully ping the Redis client', async () => {
      const isAlive = await redisService.ping();
      expect(isAlive).toBe(true);
    });

    it('should support safe get, set, exists, expire, and del operations', async () => {
      await redisService.set('test:key', 'secure-value', 60);

      const exists = await redisService.exists('test:key');
      expect(exists).toBe(true);

      const value = await redisService.get('test:key');
      expect(value).toBe('secure-value');

      const deletedCount = await redisService.del('test:key');
      expect(deletedCount).toBe(1);

      const existsAfterDel = await redisService.exists('test:key');
      expect(existsAfterDel).toBe(false);
    });

    it('should report degraded status cleanly when Redis client is disconnected', async () => {
      const tempService = redisService;
      tempService.resetClient();

      const health = await tempService.getHealth();
      expect(health.connected).toBe(false);
      expect(['degraded', 'error']).toContain(health.status);

      // Restore client
      redisService.setClient(mockRedis);
    });
  });

  // ============================================================================
  // MODULE 2: Distributed Rate Limiting Across Instances
  // ============================================================================
  describe('2. Distributed Rate Limiting Across Backend Instances', () => {
    it('should share rate-limit counters between multiple backend instances using Redis', async () => {
      const rateLimitPrefix = `test-cluster-${Date.now()}`;

      // Simulate Instance 1 and Instance 2 sharing the same Redis prefix
      const limiterInstance1 = createDistributedRateLimiter({
        windowMs: 60 * 1000,
        max: 3, // Allow maximum 3 requests per minute
        prefix: rateLimitPrefix,
        message: 'Rate limit exceeded across cluster.',
      });

      const limiterInstance2 = createDistributedRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        prefix: rateLimitPrefix,
        message: 'Rate limit exceeded across cluster.',
      });

      const app1 = express();
      app1.use(limiterInstance1);
      app1.get('/api/test', (_req, res) => res.status(200).json({ ok: true, node: 1 }));

      const app2 = express();
      app2.use(limiterInstance2);
      app2.get('/api/test', (_req, res) => res.status(200).json({ ok: true, node: 2 }));

      // Request 1 on Node 1 (1/3)
      const res1 = await request(app1).get('/api/test');
      expect(res1.status).toBe(200);
      const remaining1 = Number(res1.headers['ratelimit-remaining'] ?? res1.headers['x-ratelimit-remaining']);
      expect(remaining1).toBe(2);

      // Request 2 on Node 2 (2/3) -> reads incremented count from shared Redis
      const res2 = await request(app2).get('/api/test');
      expect(res2.status).toBe(200);
      const remaining2 = Number(res2.headers['ratelimit-remaining'] ?? res2.headers['x-ratelimit-remaining']);
      expect(remaining2).toBe(1);

      // Request 3 on Node 1 (3/3)
      const res3 = await request(app1).get('/api/test');
      expect(res3.status).toBe(200);
      const remaining3 = Number(res3.headers['ratelimit-remaining'] ?? res3.headers['x-ratelimit-remaining']);
      expect(remaining3).toBe(0);

      // Request 4 on Node 2 -> MUST BE BLOCKED (Exceeded 3 requests)
      const res4 = await request(app2).get('/api/test');
      expect(res4.status).toBe(429);
      expect(res4.body.success).toBe(false);
      expect(res4.body.message).toContain('Rate limit exceeded');
    });

    it('should safely fall back to MemoryStore when Redis is offline', async () => {
      const fallbackStore = new ResilientRateLimitStore('offline-test');
      // Force Redis offline
      redisService.resetClient();

      const limiter = createDistributedRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        prefix: 'offline-test',
        message: 'Fallback rate limit hit.',
      });

      const app = express();
      app.use(limiter);
      app.get('/test-fallback', (_req, res) => res.status(200).send('ok'));

      const r1 = await request(app).get('/test-fallback');
      expect(r1.status).toBe(200);

      const r2 = await request(app).get('/test-fallback');
      expect(r2.status).toBe(200);

      const r3 = await request(app).get('/test-fallback');
      expect(r3.status).toBe(429);

      // Restore Redis client
      redisService.setClient(mockRedis);
    });
  });

  // ============================================================================
  // MODULE 3: JWT Token Revocation & Session Invalidation
  // ============================================================================
  describe('3. JWT Token Revocation on Logout', () => {
    it('should revoke a token on logout and reject subsequent requests with 401', async () => {
      const testEmail = `redis-logout-${Date.now()}@virtuallab.edu`;
      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '$2a$12$eXampleHashedPassword12345678901234567890123456789012',
          firstName: 'Redis',
          lastName: 'Tester',
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      const app = createApp();

      // 1. Generate valid token
      const token = signToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });

      // 2. Access protected endpoint before logout -> 200 OK
      const beforeRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.data.user.email).toBe(testEmail.toLowerCase());

      // 3. User logs out
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // 4. Verify token is marked revoked
      const isRevoked = await tokenRevocationService.isTokenRevoked(token);
      expect(isRevoked).toBe(true);

      // 5. Subsequent request with the same token MUST BE REJECTED with 401
      const afterRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${token}`);

      expect(afterRes.status).toBe(401);
      expect(afterRes.body.message).toContain('revoked');

      // Cleanup
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    });

    it('should also revoke Bearer Authorization header tokens on logout', async () => {
      const testEmail = `bearer-logout-${Date.now()}@virtuallab.edu`;
      const testUser = await prisma.user.create({
        data: {
          email: testEmail,
          passwordHash: '$2a$12$eXampleHashedPassword12345678901234567890123456789012',
          firstName: 'Bearer',
          lastName: 'Tester',
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      const app = createApp();

      const token = signToken({
        userId: testUser.id,
        email: testUser.email,
        role: testUser.role,
      });

      // Logout with Bearer token
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);

      // Subsequent access with Bearer header is rejected
      const afterRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(afterRes.status).toBe(401);
      expect(afterRes.body.message).toContain('revoked');

      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    });
  });

  // ============================================================================
  // MODULE 4: Administrator User Suspension & Session Invalidation
  // ============================================================================
  describe('4. Session Invalidation on User Suspension', () => {
    it('should immediately invalidate all active sessions when an administrator suspends a user', async () => {
      // 1. Create a student user
      const studentEmail = `suspend-test-${Date.now()}@virtuallab.edu`;
      const student = await prisma.user.create({
        data: {
          email: studentEmail,
          passwordHash: '$2a$12$eXampleHashedPassword12345678901234567890123456789012',
          firstName: 'Suspendable',
          lastName: 'Student',
          role: Role.STUDENT,
          status: UserStatus.ACTIVE,
        },
      });

      // 2. Issue active token
      const studentToken = signToken({
        userId: student.id,
        email: student.email,
        role: student.role,
      });

      const app = createApp();

      // Student accesses /me successfully
      const initialRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${studentToken}`);

      expect(initialRes.status).toBe(200);

      // 3. Admin suspends the student account
      const admin = await prisma.user.findFirst({ where: { role: Role.ADMIN } });
      expect(admin).toBeDefined();

      await AdminGovernanceService.updateUserStatus(
        admin!.id,
        student.id,
        UserStatus.SUSPENDED,
        '127.0.0.1'
      );

      // 4. Verify user-level revocation in Redis service
      const isRevoked = await tokenRevocationService.isTokenRevoked(studentToken, {
        userId: student.id,
        iat: Math.floor(Date.now() / 1000) - 10, // issued 10s ago
      });
      expect(isRevoked).toBe(true);

      // 5. Immediate subsequent request with existing token MUST BE REJECTED
      const postSuspendRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Cookie', `${AUTH_COOKIE_NAME}=${studentToken}`);

      // Rejected either with 401 (session revoked in Redis) or 403 (suspended account status)
      expect([401, 403]).toContain(postSuspendRes.status);
      expect(postSuspendRes.body.success).toBe(false);

      // Cleanup
      await prisma.auditLog.deleteMany({ where: { targetId: student.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: student.id } }).catch(() => {});
    });
  });

  // ============================================================================
  // MODULE 5: Redis API Health Endpoint Verification
  // ============================================================================
  describe('5. Health Endpoint Redis Reporting', () => {
    it('should include redis dependency health in GET /api/health', async () => {
      const app = createApp();
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body).toHaveProperty('redis');
      expect(res.body.redis).toHaveProperty('status');
      expect(res.body.redis).toHaveProperty('connected');
    });
  });

  // ============================================================================
  // MODULE 6: Phase 9F.1 Storage & Password-Change Rate-Limit Hardening
  // ============================================================================
  describe('6. Phase 9F.1: Storage & Password-Change Rate-Limit Enforcement', () => {
    it('enforces 429 rate limit on storage upload/download and password-change endpoints', async () => {
      const app = createApp();
      const prevOverride = process.env.TEST_RATE_LIMIT_MAX;
      process.env.TEST_RATE_LIMIT_MAX = '2';

      try {
        const user = await prisma.user.findFirst({ where: { status: UserStatus.ACTIVE } });
        expect(user).toBeDefined();
        const token = signToken({ userId: user!.id, email: user!.email, role: user!.role });
        const cookie = `${AUTH_COOKIE_NAME}=${token}`;

        // Storage upload/download limiter check (3rd authenticated request should return 429)
        const s1 = await request(app)
          .get('/api/v1/storage/files/00000000-0000-0000-0000-000000000000/download')
          .set('Cookie', cookie);
        const s2 = await request(app)
          .get('/api/v1/storage/files/00000000-0000-0000-0000-000000000000/download')
          .set('Cookie', cookie);
        const s3 = await request(app)
          .post('/api/v1/storage/files/upload')
          .set('Cookie', cookie);

        expect(s1.status).not.toBe(429);
        expect(s2.status).not.toBe(429);
        expect(s3.status).toBe(429);
        expect(s3.body.success).toBe(false);
        expect(s3.body.message).toContain('Too many storage transfer requests');

        // Password-change limiter check (3rd request should return 429)
        const p1 = await request(app).post('/api/v1/auth/change-password').send({});
        const p2 = await request(app).post('/api/v1/auth/change-password').send({});
        const p3 = await request(app).post('/api/v1/auth/change-password').send({});

        expect(p1.status).toBe(401);
        expect(p2.status).toBe(401);
        expect(p3.status).toBe(429);
        expect(p3.body.success).toBe(false);
        expect(p3.body.message).toContain('Too many password change attempts');
      } finally {
        if (prevOverride === undefined) {
          delete process.env.TEST_RATE_LIMIT_MAX;
        } else {
          process.env.TEST_RATE_LIMIT_MAX = prevOverride;
        }
      }
    });
  });
});
