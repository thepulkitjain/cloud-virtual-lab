/**
 * Storage Provider Interface & Metadata Contracts
 * Defines standard operations required across pluggable storage backends (Local Disk, AWS S3, Cloudflare R2, MinIO)
 */

export interface StorageFileMetadata {
  mimeType?: string;
  originalName?: string;
  sizeBytes?: number | bigint;
}

export interface IStorageProvider {
  /**
   * Identifies the active storage driver name ('local' | 's3')
   */
  readonly name: string;

  /**
   * Persists an encrypted file buffer to the underlying storage backend
   * @param storedName Unique storage filename (e.g. uuid.enc)
   * @param buffer Encrypted ciphertext buffer (never plaintext)
   * @param metadata Optional metadata
   */
  saveFile(storedName: string, buffer: Buffer, metadata?: StorageFileMetadata): Promise<void>;

  /**
   * Retrieves an encrypted file buffer from the storage backend
   * @param storedName Unique storage filename
   * @returns Encrypted ciphertext buffer
   */
  getFile(storedName: string): Promise<Buffer>;

  /**
   * Removes an encrypted file from the storage backend
   * @param storedName Unique storage filename
   */
  deleteFile(storedName: string): Promise<void>;

  /**
   * Checks whether an encrypted file exists in the storage backend
   * @param storedName Unique storage filename
   */
  fileExists(storedName: string): Promise<boolean>;
}
