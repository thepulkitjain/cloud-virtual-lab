import crypto from 'crypto';
import { AppError } from '../types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // 96-bit initialization vector recommended by NIST for GCM
const AUTH_TAG_LENGTH_BYTES = 16; // 128-bit authentication tag

/**
 * Derives and validates a 32-byte (256-bit) encryption key from environment variable
 */
export const getEncryptionKey = (): Buffer => {
  const secret =
    process.env.STORAGE_ENCRYPTION_SECRET ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  // Check if hex-encoded 64 character string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Check if raw 32-byte string
  const buf = Buffer.from(secret, 'utf-8');
  if (buf.length === 32) {
    return buf;
  }

  // Fallback: derive 32-byte key via SHA-256 digest
  return crypto.createHash('sha256').update(secret).digest();
};

export interface EncryptionResult {
  encryptedBuffer: Buffer;
  ivHex: string;
  authTagHex: string;
  checksumSha256: string;
}

/**
 * Encrypts an in-memory buffer using AES-256-GCM.
 * Generates a unique 96-bit IV, 128-bit authentication tag, and SHA-256 integrity checksum.
 */
export const encryptFileBuffer = (buffer: Buffer): EncryptionResult => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);

  // Compute original file checksum for tamper detection & auditing
  const checksumSha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encryptedBuffer = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedBuffer,
    ivHex: iv.toString('hex'),
    authTagHex: authTag.toString('hex'),
    checksumSha256,
  };
};

/**
 * Decrypts an AES-256-GCM encrypted buffer using stored IV and authentication tag.
 * If ciphertext, IV, or AuthTag have been tampered with or corrupted, decryption fails.
 */
export const decryptFileBuffer = (
  encryptedBuffer: Buffer,
  ivHex: string,
  authTagHex: string
): Buffer => {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH_BYTES) {
      throw new AppError('Invalid encryption IV length.', 400);
    }
    if (authTag.length !== AUTH_TAG_LENGTH_BYTES) {
      throw new AppError('Invalid encryption authentication tag length.', 400);
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decrypted;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    // GCM authentication failure happens in decipher.final() if tag does not match
    throw new AppError(
      'Decryption failed: Integrity verification failed. The file is corrupted, tampered with, or key/tag is invalid.',
      400
    );
  }
};
