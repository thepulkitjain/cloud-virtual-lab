import multer from 'multer';
import { Request } from 'express';
import { isDangerousExtension } from '../utils/file-category.util';
import { AppError } from '../types';

const MAX_SIZE_BYTES =
  (parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10)) * 1024 * 1024;

// Use in-memory buffer so raw plaintext is NEVER written to unencrypted disk
const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (isDangerousExtension(file.originalname)) {
    return cb(
      new AppError(
        'File upload rejected: Executable programs and dangerous scripts (.exe, .bat, .sh, .msi, etc.) are prohibited for security.',
        400
      )
    );
  }
  cb(null, true);
};

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_SIZE_BYTES,
    files: 1, // Single file upload per request
  },
  fileFilter,
});
