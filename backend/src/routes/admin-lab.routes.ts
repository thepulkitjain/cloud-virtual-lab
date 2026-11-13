import { Router } from 'express';
import { AdminLabController } from '../controllers/admin-lab.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/role.middleware';
import { validate } from '../middleware/validate.middleware';
import { Role } from '@prisma/client';
import {
  createLabSchema,
  updateLabSchema,
  createExerciseSchema,
  updateExerciseSchema,
} from '../validators/lab.validator';

const router = Router();

// Enforce authentication & ADMIN role for all administrative lab routes
router.use(authenticate, requireRoles(Role.ADMIN));

router.post('/labs', validate(createLabSchema), AdminLabController.createLab);
router.put('/labs/:id', validate(updateLabSchema), AdminLabController.updateLab);

router.post('/labs/:labId/exercises', validate(createExerciseSchema), AdminLabController.createExercise);
router.put('/exercises/:exerciseId', validate(updateExerciseSchema), AdminLabController.updateExercise);
router.delete('/exercises/:exerciseId', AdminLabController.deleteExercise);

export default router;
