import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  LocalStorageProvider,
  S3StorageProvider,
  getStorageProvider,
  setStorageProvider,
  resetStorageProvider,
  IStorageProvider,
} from '../services/storage';
import { encryptFileBuffer, decryptFileBuffer } from '../utils/crypto.util';
import { AppError } from '../types';

describe('Module 9B: Storage Provider Abstraction & S3 Compatibility Tests', () => {
  const testUploadDir = path.resolve(__dirname, '../../test-storage-provider-uploads');

  beforeEach(() => {
    resetStorageProvider();
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  afterEach(() => {
    resetStorageProvider();
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('1. LocalStorageProvider', () => {
    it('should save, retrieve, check existence, and delete encrypted files', async () => {
      const provider = new LocalStorageProvider(testUploadDir);
      expect(provider.name).toBe('local');

      const testFileName = 'test_sample_file.enc';
      const samplePayload = Buffer.from('AES-256-GCM-CIPHERTEXT-DUMMY-DATA-12345');

      // 1. Initial existence check
      expect(await provider.fileExists(testFileName)).toBe(false);

      // 2. Save file
      await provider.saveFile(testFileName, samplePayload);
      expect(await provider.fileExists(testFileName)).toBe(true);

      // 3. Verify file on disk
      const diskPath = path.join(testUploadDir, testFileName);
      expect(fs.existsSync(diskPath)).toBe(true);

      // 4. Retrieve file
      const retrieved = await provider.getFile(testFileName);
      expect(retrieved).toEqual(samplePayload);

      // 5. Delete file
      await provider.deleteFile(testFileName);
      expect(await provider.fileExists(testFileName)).toBe(false);
      expect(fs.existsSync(diskPath)).toBe(false);
    });

    it('should throw 404 AppError when attempting to retrieve a non-existent file', async () => {
      const provider = new LocalStorageProvider(testUploadDir);
      await expect(provider.getFile('non_existent.enc')).rejects.toThrow(
        'Encrypted file payload missing from storage volume.'
      );
    });

    it('should sanitize path traversal attempts in stored filenames', async () => {
      const provider = new LocalStorageProvider(testUploadDir);
      const maliciousName = '../../etc/passwd.enc';
      const samplePayload = Buffer.from('sanitized-data');

      await provider.saveFile(maliciousName, samplePayload);

      // Verify it was saved inside testUploadDir with basename 'passwd.enc', NOT in parent directory
      const expectedPath = path.join(testUploadDir, 'passwd.enc');
      expect(fs.existsSync(expectedPath)).toBe(true);

      await provider.deleteFile(maliciousName);
      expect(fs.existsSync(expectedPath)).toBe(false);
    });
  });

  describe('2. S3StorageProvider (Mocked AWS SDK v3 Client)', () => {
    const mockBucket = 'cloud-virtual-lab-encrypted-bucket';

    it('should require S3_BUCKET configuration and throw 500 AppError if omitted', () => {
      const oldBucket = process.env.S3_BUCKET;
      delete process.env.S3_BUCKET;

      expect(() => new S3StorageProvider({ bucket: '' })).toThrow(
        'S3_BUCKET is required when using the s3 storage driver.'
      );

      if (oldBucket) process.env.S3_BUCKET = oldBucket;
    });

    it('should upload encrypted file to S3 with correct PutObject parameters', async () => {
      const mockClient: any = {
        send: vi.fn().mockResolvedValue({}),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        region: 'us-west-2',
        client: mockClient,
      });

      expect(provider.name).toBe('s3');

      const storedName = 'sample_cloud_file.enc';
      const cipherBuffer = Buffer.from('ENCRYPTED-OCTET-STREAM');

      await provider.saveFile(storedName, cipherBuffer, {
        originalName: 'report.pdf',
        mimeType: 'application/pdf',
      });

      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.input.Bucket).toBe(mockBucket);
      expect(sentCommand.input.Key).toBe(storedName);
      expect(sentCommand.input.ContentType).toBe('application/octet-stream');
      expect(sentCommand.input.Body).toEqual(cipherBuffer);
    });

    it('should download encrypted file from S3 and return a Buffer', async () => {
      const cipherBytes = Buffer.from('ENCRYPTED-PAYLOAD-FROM-S3');
      const mockClient: any = {
        send: vi.fn().mockResolvedValue({
          Body: {
            transformToByteArray: vi.fn().mockResolvedValue(new Uint8Array(cipherBytes)),
          },
        }),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        client: mockClient,
      });

      const result = await provider.getFile('sample_cloud_file.enc');
      expect(result).toEqual(cipherBytes);
      expect(mockClient.send).toHaveBeenCalledTimes(1);
    });

    it('should translate S3 NoSuchKey / 404 to AppError with status 404', async () => {
      const notFoundError = new Error('NoSuchKey');
      notFoundError.name = 'NoSuchKey';

      const mockClient: any = {
        send: vi.fn().mockRejectedValue(notFoundError),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        client: mockClient,
      });

      await expect(provider.getFile('missing.enc')).rejects.toThrow(
        'Encrypted file payload missing from cloud storage bucket.'
      );
    });

    it('should check file existence in S3 using HeadObjectCommand', async () => {
      const mockClient: any = {
        send: vi.fn().mockResolvedValue({ ContentLength: 1024 }),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        client: mockClient,
      });

      expect(await provider.fileExists('exists.enc')).toBe(true);

      // Now mock NotFound
      const notFoundError = new Error('NotFound');
      notFoundError.name = 'NotFound';
      mockClient.send = vi.fn().mockRejectedValue(notFoundError);

      expect(await provider.fileExists('missing.enc')).toBe(false);
    });

    it('should delete file in S3 using DeleteObjectCommand', async () => {
      const mockClient: any = {
        send: vi.fn().mockResolvedValue({}),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        client: mockClient,
      });

      await provider.deleteFile('delete_me.enc');
      expect(mockClient.send).toHaveBeenCalledTimes(1);
      const sentCommand = mockClient.send.mock.calls[0][0];
      expect(sentCommand.input.Key).toBe('delete_me.enc');
    });

    it('should wrap S3 network failure in a 500 AppError', async () => {
      const networkError = new Error('Connection refused to S3 endpoint');
      const mockClient: any = {
        send: vi.fn().mockRejectedValue(networkError),
      };

      const provider = new S3StorageProvider({
        bucket: mockBucket,
        client: mockClient,
      });

      await expect(
        provider.saveFile('test.enc', Buffer.from('data'))
      ).rejects.toThrow('S3 storage upload error: Connection refused to S3 endpoint');
    });
  });

  describe('3. AES-256-GCM End-to-End Cryptography with Storage Providers', () => {
    it('should encrypt plaintext, persist ciphertext to provider, retrieve, and decrypt losslessly', async () => {
      const localProvider = new LocalStorageProvider(testUploadDir);
      const originalText = 'CONFIDENTIAL ACADEMIC REPORT: Quantum Cryptography and Zero-Knowledge Systems 2026.';
      const originalBuffer = Buffer.from(originalText, 'utf-8');

      // 1. Encrypt plaintext
      const { encryptedBuffer, ivHex, authTagHex, checksumSha256 } = encryptFileBuffer(originalBuffer);

      // 2. Persist ciphertext to storage provider (Zero plaintext on disk)
      const storedName = 'quantum_report.enc';
      await localProvider.saveFile(storedName, encryptedBuffer);

      // 3. Inspect raw ciphertext on disk
      const rawStoredBytes = await localProvider.getFile(storedName);
      expect(rawStoredBytes.toString('utf-8')).not.toContain('CONFIDENTIAL');
      expect(rawStoredBytes).toEqual(encryptedBuffer);

      // 4. Decrypt via stored IV and Auth Tag
      const decryptedBuffer = decryptFileBuffer(rawStoredBytes, ivHex, authTagHex);
      expect(decryptedBuffer.toString('utf-8')).toBe(originalText);

      // 5. Cleanup
      await localProvider.deleteFile(storedName);
    });

    it('should fail decryption if stored ciphertext is tampered with', async () => {
      const localProvider = new LocalStorageProvider(testUploadDir);
      const originalBuffer = Buffer.from('Top secret research proposal', 'utf-8');
      const { encryptedBuffer, ivHex, authTagHex } = encryptFileBuffer(originalBuffer);

      // Tamper with the ciphertext by flipping one byte
      const tamperedBuffer = Buffer.from(encryptedBuffer);
      tamperedBuffer[0] = tamperedBuffer[0] ^ 0xff;

      const storedName = 'tampered.enc';
      await localProvider.saveFile(storedName, tamperedBuffer);

      const retrieved = await localProvider.getFile(storedName);
      expect(() => decryptFileBuffer(retrieved, ivHex, authTagHex)).toThrow(
        /Integrity verification failed/
      );

      await localProvider.deleteFile(storedName);
    });
  });

  describe('4. Storage Provider Factory & Driver Selection', () => {
    it('should default to LocalStorageProvider when STORAGE_DRIVER is unset or "local"', () => {
      delete process.env.STORAGE_DRIVER;
      resetStorageProvider();

      const provider = getStorageProvider();
      expect(provider.name).toBe('local');
      expect(provider instanceof LocalStorageProvider).toBe(true);
    });

    it('should instantiate S3StorageProvider when STORAGE_DRIVER="s3" with valid bucket', () => {
      process.env.STORAGE_DRIVER = 's3';
      process.env.S3_BUCKET = 'test-bucket';
      resetStorageProvider();

      const provider = getStorageProvider();
      expect(provider.name).toBe('s3');
      expect(provider instanceof S3StorageProvider).toBe(true);

      delete process.env.STORAGE_DRIVER;
      delete process.env.S3_BUCKET;
      resetStorageProvider();
    });

    it('should allow mock provider injection via setStorageProvider', async () => {
      const mockProvider: IStorageProvider = {
        name: 'mock',
        saveFile: vi.fn().mockResolvedValue(undefined),
        getFile: vi.fn().mockResolvedValue(Buffer.from('mocked-bytes')),
        deleteFile: vi.fn().mockResolvedValue(undefined),
        fileExists: vi.fn().mockResolvedValue(true),
      };

      setStorageProvider(mockProvider);

      const active = getStorageProvider();
      expect(active.name).toBe('mock');

      const data = await active.getFile('any.enc');
      expect(data.toString()).toBe('mocked-bytes');

      resetStorageProvider();
    });
  });
});
