import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3002', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  accessTokenExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshTokenExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  url: process.env.REDIS_URL || undefined,
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL || 'file:../../db/ecommerce.db',
}));

export const whatsappConfig = registerAs('whatsapp', () => ({
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  number: process.env.WHATSAPP_NUMBER || '+6281234567890',
}));

export const uploadConfig = registerAs('upload', () => ({
  dir: process.env.UPLOAD_DIR || './uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
}));
