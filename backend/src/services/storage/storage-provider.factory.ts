import { IStorageProvider } from './storage-provider.interface';
import { LocalStorageProvider } from './local-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';

let activeProvider: IStorageProvider | null = null;

/**
 * Resolves the active storage provider according to the STORAGE_DRIVER environment configuration.
 * Defaults to 'local' for filesystem persistence, or 's3' for AWS S3, Cloudflare R2, and MinIO.
 */
export const getStorageProvider = (): IStorageProvider => {
  if (activeProvider) {
    return activeProvider;
  }

  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase().trim();

  if (driver === 's3') {
    activeProvider = new S3StorageProvider();
  } else {
    activeProvider = new LocalStorageProvider();
  }

  return activeProvider;
};

/**
 * Overrides the active storage provider (useful for testing and mocking)
 */
export const setStorageProvider = (provider: IStorageProvider | null): void => {
  activeProvider = provider;
};

/**
 * Resets the active storage provider singleton to re-read environment variables
 */
export const resetStorageProvider = (): void => {
  activeProvider = null;
};
