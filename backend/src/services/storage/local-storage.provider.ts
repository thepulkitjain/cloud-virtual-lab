import fs from 'fs';
import path from 'path';
import { IStorageProvider, StorageFileMetadata } from './storage-provider.interface';
import { AppError } from '../../types';

export class LocalStorageProvider implements IStorageProvider {
  public readonly name = 'local';
  private uploadDir: string;

  constructor(customUploadDir?: string) {
    if (customUploadDir) {
      this.uploadDir = customUploadDir;
    } else {
      const configuredPath = process.env.STORAGE_UPLOAD_PATH || '../storage/uploads';
      this.uploadDir = path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(__dirname, '../../../', configuredPath);
    }

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private getFilePath(storedName: string): string {
    // Sanitize to prevent path traversal
    const safeName = path.basename(storedName.replace(/\\/g, '/'));
    return path.join(this.uploadDir, safeName);
  }

  async saveFile(storedName: string, buffer: Buffer, _metadata?: StorageFileMetadata): Promise<void> {
    const targetPath = this.getFilePath(storedName);
    await fs.promises.writeFile(targetPath, buffer);
  }

  async getFile(storedName: string): Promise<Buffer> {
    const targetPath = this.getFilePath(storedName);
    if (!fs.existsSync(targetPath)) {
      throw new AppError('Encrypted file payload missing from storage volume.', 404);
    }
    return await fs.promises.readFile(targetPath);
  }

  async deleteFile(storedName: string): Promise<void> {
    const targetPath = this.getFilePath(storedName);
    if (fs.existsSync(targetPath)) {
      try {
        await fs.promises.unlink(targetPath);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.error(`Failed to unlink local file ${targetPath}:`, err);
        }
      }
    }
  }

  async fileExists(storedName: string): Promise<boolean> {
    const targetPath = this.getFilePath(storedName);
    return fs.existsSync(targetPath);
  }
}
