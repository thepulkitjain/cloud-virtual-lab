import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { IStorageProvider, StorageFileMetadata } from './storage-provider.interface';
import { AppError } from '../../types';

export interface S3ProviderConfig {
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  client?: S3Client;
}

export class S3StorageProvider implements IStorageProvider {
  public readonly name = 's3';
  private bucket: string;
  private region: string;
  private endpoint?: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;
  private forcePathStyle: boolean;
  private client: S3Client;

  constructor(config?: S3ProviderConfig) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || '';
    if (!this.bucket) {
      throw new AppError('S3_BUCKET is required when using the s3 storage driver.', 500);
    }

    this.region = config?.region || process.env.S3_REGION || 'us-east-1';
    this.endpoint = config?.endpoint || process.env.S3_ENDPOINT || undefined;
    this.accessKeyId =
      config?.accessKeyId || process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    this.secretAccessKey =
      config?.secretAccessKey ||
      process.env.S3_SECRET_ACCESS_KEY ||
      process.env.AWS_SECRET_ACCESS_KEY;
    this.forcePathStyle =
      config?.forcePathStyle !== undefined
        ? config.forcePathStyle
        : process.env.S3_FORCE_PATH_STYLE === 'true';

    if (config?.client) {
      this.client = config.client;
    } else {
      const s3Config: any = {
        region: this.region,
        forcePathStyle: this.forcePathStyle,
      };

      if (this.endpoint) {
        s3Config.endpoint = this.endpoint;
      }

      if (this.accessKeyId && this.secretAccessKey) {
        s3Config.credentials = {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        };
      }

      this.client = new S3Client(s3Config);
    }
  }

  private getKey(storedName: string): string {
    return path.basename(storedName.replace(/\\/g, '/'));
  }

  async saveFile(storedName: string, buffer: Buffer, metadata?: StorageFileMetadata): Promise<void> {
    const key = this.getKey(storedName);
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: 'application/octet-stream', // Ciphertext is always octet-stream
        Metadata: {
          'original-name': encodeURIComponent(metadata?.originalName || ''),
          'content-type': metadata?.mimeType || 'application/octet-stream',
        },
      });
      await this.client.send(command);
    } catch (err: any) {
      throw new AppError(`S3 storage upload error: ${err.message}`, 500);
    }
  }

  async getFile(storedName: string): Promise<Buffer> {
    const key = this.getKey(storedName);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new AppError('Encrypted file payload missing from cloud storage bucket.', 404);
      }

      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err: any) {
      if (
        err.name === 'NoSuchKey' ||
        err.name === 'NotFound' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        throw new AppError('Encrypted file payload missing from cloud storage bucket.', 404);
      }
      if (err instanceof AppError) throw err;
      throw new AppError(`S3 storage retrieval error: ${err.message}`, 500);
    }
  }

  async deleteFile(storedName: string): Promise<void> {
    const key = this.getKey(storedName);
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
    } catch (err: any) {
      console.error(`Failed to delete S3 object ${key}:`, err);
    }
  }

  async fileExists(storedName: string): Promise<boolean> {
    const key = this.getKey(storedName);
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      if (
        err.name === 'NotFound' ||
        err.name === 'NoSuchKey' ||
        err.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      throw new AppError(`S3 existence check error: ${err.message}`, 500);
    }
  }
}
