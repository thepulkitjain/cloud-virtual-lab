import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authLimiter, passwordChangeLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// Public routes (Rate limited to thwart brute-force attacks)
router.post('/register', authLimiter, validate(registerSchema), AuthController.register);
router.post('/login', authLimiter, validate(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);

// Protected routes (Requires valid JWT session)
router.get('/me', authenticate, AuthController.getMe);
router.put('/profile', authenticate, validate(updateProfileSchema), AuthController.updateProfile);
router.post(
  '/change-password',
  passwordChangeLimiter,
  authenticate,
  validate(changePasswordSchema),
  AuthController.changePassword
);

export default router;
