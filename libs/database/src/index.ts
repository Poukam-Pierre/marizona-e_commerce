/**
 * Database Client for Nx Monorepo
 * Provides a shared Prisma client instance for all apps
 */

import { PrismaClient } from '@prisma/client';

// Global type for Prisma client singleton
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Prevent multiple instances in development
export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

// Export Prisma types for use across apps
export * from '@prisma/client';

// Export Prisma client
export default prisma;

/**
 * Database helper utilities
 */
export const db = {
  /**
   * Connect to database and verify connection
   */
  async connect() {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  },

  /**
   * Disconnect from database
   */
  async disconnect() {
    await prisma.$disconnect();
    console.log('Database disconnected');
  },

  /**
   * Health check for database
   */
  async healthCheck() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: String(error), timestamp: new Date().toISOString() };
    }
  },

  /**
   * Execute a transaction
   */
  async transaction<T>(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<T>) {
    return prisma.$transaction(fn);
  },
};
