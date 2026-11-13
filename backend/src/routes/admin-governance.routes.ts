import { Router } from 'express';
import { AdminGovernanceController } from '../controllers/admin-governance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  updateUserStatusSchema,
  updateUserRoleSchema,
  toggleLabStatusSchema,
} from '../validators/admin-governance.validator';

const router = Router();

// Strict security: require authentication and ADMIN role for all administrative governance endpoints
router.use(authenticate, requireRoles(Role.ADMIN));

// 1. Dashboard Overview
router.get('/dashboard', AdminGovernanceController.getDashboard);

// 2. User Management
router.get('/users', AdminGovernanceController.listUsers);
router.get('/users/:id', AdminGovernanceController.getUser);
router.patch('/users/:id/status', validate(updateUserStatusSchema), AdminGovernanceController.updateUserStatus);
router.patch('/users/:id/role', validate(updateUserRoleSchema), AdminGovernanceController.updateUserRole);

// 3. Activity & Audit Monitoring
router.get('/activities', AdminGovernanceController.listActivities);
router.get('/audit-logs', AdminGovernanceController.listAuditLogs);

// 4. Laboratory Governance
router.get('/labs/governance', AdminGovernanceController.getLabGovernance);
router.get('/labs/:id/performance', AdminGovernanceController.getLabPerformance);
router.patch('/labs/:id/status', validate(toggleLabStatusSchema), AdminGovernanceController.toggleLabStatus);

export default router;
