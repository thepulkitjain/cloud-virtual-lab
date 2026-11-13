import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storage.service';
import { sendResponse } from '../utils/apiResponse';
import { AppError } from '../types';
import { Role } from '@prisma/client';

export class StorageController {
  static async getQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quota = await StorageService.getStorageQuota(req.user!.id);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Storage quota metrics retrieved successfully.',
        data: { quota },
      });
    } catch (error) {
      next(error);
    }
  }

  static async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('Please select a file to upload.', 400);
      }

      const folderId = req.body.folderId || null;
      const fileRecord = await StorageService.uploadFile(
        req.user!.id,
        req.file,
        folderId,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 201,
        message: 'File encrypted with AES-256-GCM and stored securely.',
        data: { file: fileRecord },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { folderId, search, category, sortBy, sortOrder } = req.query;

      const files = await StorageService.listFiles(req.user!.id, {
        ...(folderId !== undefined && { folderId: folderId ? String(folderId) : null }),
        ...(search && { search: String(search) }),
        ...(category && { category: category as any }),
        ...(sortBy && { sortBy: sortBy as any }),
        ...(sortOrder && { sortOrder: sortOrder as any }),
      });

      sendResponse({
        res,
        statusCode: 200,
        message: 'Files retrieved successfully.',
        data: { files },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === Role.ADMIN;
      const file = await StorageService.getFileDetails(req.user!.id, req.params.id, isAdmin);

      sendResponse({
        res,
        statusCode: 200,
        message: 'File details retrieved successfully.',
        data: { file },
      });
    } catch (error) {
      next(error);
    }
  }

  static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === Role.ADMIN;
      const { decryptedBuffer, originalName, mimeType } = await StorageService.downloadFile(
        req.user!.id,
        req.params.id,
        isAdmin
      );

      // Set download headers
      res.setHeader('Content-Type', mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(originalName)}"`
      );
      res.setHeader('Content-Length', decryptedBuffer.length);

      res.status(200).send(decryptedBuffer);
    } catch (error) {
      next(error);
    }
  }

  static async renameFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const updated = await StorageService.renameFile(req.user!.id, req.params.id, name);

      sendResponse({
        res,
        statusCode: 200,
        message: 'File renamed successfully.',
        data: { file: updated },
      });
    } catch (error) {
      next(error);
    }
  }

  static async moveFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { targetFolderId } = req.body;
      const updated = await StorageService.moveFile(
        req.user!.id,
        req.params.id,
        targetFolderId || null
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'File moved successfully.',
        data: { file: updated },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user!.role === Role.ADMIN;
      const result = await StorageService.deleteFile(
        req.user!.id,
        req.params.id,
        isAdmin,
        req.ip
      );

      sendResponse({
        res,
        statusCode: 200,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  // Folders
  static async createFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, parentId } = req.body;
      const folder = await StorageService.createFolder(req.user!.id, name, parentId || null);

      sendResponse({
        res,
        statusCode: 201,
        message: 'Folder created successfully.',
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  static async listFolders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { parentId } = req.query;
      const folders = await StorageService.listFolders(
        req.user!.id,
        parentId !== undefined ? (parentId ? String(parentId) : null) : undefined
      );

      sendResponse({
        res,
        statusCode: 200,
        message: 'Folders retrieved successfully.',
        data: { folders },
      });
    } catch (error) {
      next(error);
    }
  }

  static async renameFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body;
      const folder = await StorageService.renameFolder(req.user!.id, req.params.id, name);

      sendResponse({
        res,
        statusCode: 200,
        message: 'Folder renamed successfully.',
        data: { folder },
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFolder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await StorageService.deleteFolder(req.user!.id, req.params.id);

      sendResponse({
        res,
        statusCode: 200,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}
