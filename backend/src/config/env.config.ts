import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AppConfig {
  port: number;
  nodeEnv: string;
  clientUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  storageEncryptionSecret: string;
  storageUploadPath: string;
  maxFileSizeMb: number;
  defaultUserQuotaMb: number;
  adminEmail: string;
}

/**
 * Validates critical environment variables at startup.
 * Prevents server from starting with insecure or missing credentials in production.
 */
export const validateEnvironment = (): AppConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl && process.env.NODE_ENV !== 'test') {
    errors.push('DATABASE_URL is required but not set.');
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && isProduction) {
    errors.push('JWT_SECRET is required in production mode.');
  } else if (jwtSecret && jwtSecret.length < 32 && isProduction) {
    errors.push('JWT_SECRET must be at least 32 characters long in production mode.');
  }

  const encryptionSecret = process.env.STORAGE_ENCRYPTION_SECRET;
  if (!encryptionSecret && isProduction) {
    errors.push('STORAGE_ENCRYPTION_SECRET is required in production mode.');
  }

  if (errors.length > 0) {
    console.error('❌ Critical Environment Configuration Error(s):');
    errors.forEach((err) => console.error(`   - ${err}`));
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }

  return {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    databaseUrl: databaseUrl || '',
    jwtSecret: jwtSecret || 'super_secret_jwt_signing_key_change_in_production_min32chars',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
    storageEncryptionSecret:
      encryptionSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    storageUploadPath: process.env.STORAGE_UPLOAD_PATH || '../storage/uploads',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
    defaultUserQuotaMb: parseInt(process.env.DEFAULT_USER_QUOTA_MB || '100', 10),
    adminEmail: process.env.ADMIN_EMAIL || 'admin@virtuallab.edu',
  };
};

export const envConfig = validateEnvironment();
export default envConfig;
