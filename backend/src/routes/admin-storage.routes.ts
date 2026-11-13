import { Router } from 'express';
import { AdminStorageController } from '../controllers/admin-storage.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { Role } from '@prisma/client';
import { updateQuotaSchema } from '../validators/admin-storage.validator';

const router = Router();

// Strict security: require authentication and ADMIN role for all administrative storage operations
router.use(authenticate, requireRoles(Role.ADMIN));

router.get('/overview', AdminStorageController.getOverview);
router.get('/users', AdminStorageController.listUsersStorage);
router.patch('/users/:userId/quota', validate(updateQuotaSchema), AdminStorageController.updateUserQuota);
router.get('/files', AdminStorageController.listAllFiles);
router.delete('/files/:id', AdminStorageController.deleteFile);

export default router;
