import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth.middleware';
import { requireRoles } from './middleware/role.middleware';
import { Role } from '@prisma/client';
import { AppError } from './types';
import { redisService } from './services/redis/redis.service';

export const createApp = (): Application => {
  const app = express();

  // Enable trust proxy for secure cookies and accurate client IP when behind reverse proxies (Nginx, Cloudflare, etc.)
  app.set('trust proxy', 1);

  // 1. Security Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing (CORS) with Credentials
  const rawClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const allowedOrigins = rawClientUrl.includes(',')
    ? rawClientUrl.split(',').map((url) => url.trim())
    : rawClientUrl;

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Base Health Check Endpoint (includes Redis distributed service status)
  app.get('/api/health', async (_req: Request, res: Response) => {
    const redisHealth = await redisService.getHealth();

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Cloud Virtual Lab and Secure Storage Management System Backend',
      redis: {
        status: redisHealth.status,
        connected: redisHealth.connected,
        ...(redisHealth.latencyMs !== undefined && { latencyMs: redisHealth.latencyMs }),
        ...(redisHealth.details && { details: redisHealth.details }),
      },
    });
  });

  // 5. Versioned API Routes
  app.use('/api/v1', apiRouter);

  // 6. Security Verification Test Route (RBAC verification in test mode)
  if (process.env.NODE_ENV === 'test') {
    app.get(
      '/api/v1/test/admin-only',
      authenticate,
      requireRoles(Role.ADMIN),
      (_req: Request, res: Response) => {
        res.status(200).json({ success: true, message: 'Admin authorized access granted.' });
      }
    );
  }

  // 7. Handle Undefined Routes (404)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(
      new AppError(
        `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
        404
      )
    );
  });

  // 8. Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
};

export default createApp;
