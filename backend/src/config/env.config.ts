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
  cookieSameSite: string;
  cookieSecure: boolean;
  storageDriver: string;
  storageEncryptionSecret: string;
  storageUploadPath: string;
  s3Bucket?: string;
  s3Region?: string;
  s3Endpoint?: string;
  s3ForcePathStyle?: boolean;
  maxFileSizeMb: number;
  defaultUserQuotaMb: number;
  adminEmail: string;
  redisEnabled: boolean;
  redisUrl?: string;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb: number;
  redisKeyPrefix: string;
  redisRequired: boolean;
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

  const storageDriver = (process.env.STORAGE_DRIVER || 'local').toLowerCase().trim();
  if (storageDriver === 's3' && !process.env.S3_BUCKET && isProduction) {
    errors.push('S3_BUCKET is required when STORAGE_DRIVER is set to "s3" in production.');
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
    cookieSameSite: process.env.COOKIE_SAME_SITE || (isProduction ? 'strict' : 'lax'),
    cookieSecure: process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : isProduction,
    storageDriver: storageDriver,
    storageEncryptionSecret:
      encryptionSecret || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    storageUploadPath: process.env.STORAGE_UPLOAD_PATH || '../storage/uploads',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3Endpoint: process.env.S3_ENDPOINT,
    s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '25', 10),
    defaultUserQuotaMb: parseInt(process.env.DEFAULT_USER_QUOTA_MB || '100', 10),
    adminEmail: process.env.ADMIN_EMAIL || 'admin@virtuallab.edu',
    redisEnabled: process.env.REDIS_ENABLED !== 'false',
    redisUrl: process.env.REDIS_URL,
    redisHost: process.env.REDIS_HOST || 'localhost',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
    redisPassword: process.env.REDIS_PASSWORD || undefined,
    redisDb: parseInt(process.env.REDIS_DB || '0', 10),
    redisKeyPrefix: process.env.REDIS_KEY_PREFIX || 'cvl:',
    redisRequired: process.env.REDIS_REQUIRED === 'true',
  };
};

export const envConfig = validateEnvironment();
export default envConfig;
