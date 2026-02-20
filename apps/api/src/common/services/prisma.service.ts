import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Database connected successfully');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Execute a transaction with automatic retry on conflict
   */
  async executeTransaction<T>(
    fn: (tx: Parameters<Parameters<this['$transaction']>[0]>[0]) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.$transaction(fn);
      } catch (error: any) {
        if (error.code === 'P2034') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}
