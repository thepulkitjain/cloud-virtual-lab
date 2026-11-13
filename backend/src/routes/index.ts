import { Router } from 'express';
import authRoutes from './auth.routes';
import labRoutes from './lab.routes';
import adminLabRoutes from './admin-lab.routes';
import adminStorageRoutes from './admin-storage.routes';
import adminGovernanceRoutes from './admin-governance.routes';
import storageRoutes from './storage.routes';

const router = Router();

// Modular Subsystem Mount Points
router.use('/auth', authRoutes);
router.use('/labs', labRoutes);
router.use('/storage', storageRoutes);

// Administrative Governance & Management Mount Points
router.use('/admin/storage', adminStorageRoutes);
router.use('/admin', adminGovernanceRoutes);
router.use('/admin', adminLabRoutes);

export default router;
