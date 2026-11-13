import { Router } from 'express';
import { StorageController } from '../controllers/storage.controller';
import { authenticate } from '../middleware/auth.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createFolderSchema,
  renameFolderSchema,
  renameFileSchema,
  moveFileSchema,
} from '../validators/storage.validator';

const router = Router();

// Storage endpoints require active authentication
router.use(authenticate);

// 1. Quota & Capacity Overview Metrics
router.get('/', StorageController.getQuota);
router.get('/overview', StorageController.getQuota);
router.get('/quota', StorageController.getQuota);

// 2. Folder Management
router.post('/folders', validate(createFolderSchema), StorageController.createFolder);
router.get('/folders', StorageController.listFolders);
router.patch('/folders/:id', validate(renameFolderSchema), StorageController.renameFolder);
router.put('/folders/:id', validate(renameFolderSchema), StorageController.renameFolder);
router.delete('/folders/:id', StorageController.deleteFolder);

// 3. File Operations
router.post('/files/upload', uploadMiddleware.single('file'), StorageController.upload);
router.get('/files', StorageController.listFiles);
router.get('/files/:id', StorageController.getFile);
router.get('/files/:id/download', StorageController.download);
router.patch('/files/:id', validate(renameFileSchema), StorageController.renameFile);
router.put('/files/:id', validate(renameFileSchema), StorageController.renameFile);
router.patch('/files/:id/move', validate(moveFileSchema), StorageController.moveFile);
router.delete('/files/:id', StorageController.deleteFile);

export default router;
