import { Router } from 'express';
import { LabController } from '../controllers/lab.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  executeCommandSchema,
  submitExerciseSchema,
  tabCompleteSchema,
} from '../validators/lab.validator';

const router = Router();

// 1. Browse and view labs (Public / Authenticated)
router.get('/', LabController.getLabs);

// 2. Student Session Management (Requires Authentication)
router.get('/my-sessions', authenticate, LabController.getMySessions);
router.get('/sessions/:sessionId', authenticate, LabController.getSession);
router.get('/:idOrSlug', authenticate, LabController.getLab);

// 3. Interactive Lab Execution & Life-cycle
router.post('/:labId/sessions', authenticate, LabController.startSession);
router.post(
  '/sessions/:sessionId/execute',
  authenticate,
  validate(executeCommandSchema),
  LabController.executeCommand
);
router.post(
  '/sessions/:sessionId/complete',
  authenticate,
  validate(tabCompleteSchema),
  LabController.tabComplete
);
router.post(
  '/sessions/:sessionId/submit',
  authenticate,
  validate(submitExerciseSchema),
  LabController.submitExercise
);
router.post('/sessions/:sessionId/end', authenticate, LabController.endSession);

export default router;
