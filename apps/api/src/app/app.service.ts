import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { RedisService } from '../common/services/redis.service';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime?: number;
  version?: string;
  responseTime?: number;
  services?: {
    database: {
      status: 'healthy' | 'unhealthy';
      latency?: number;
      message?: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy' | 'not_configured';
      latency?: number;
      message?: string;
    };
  };
}
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  getData(): { message: string } {
    return { message: 'Hello API' };
  }

  async getHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      // Check database
      const dbCheck = await this.checkDatabase();

      // Check Redis
      const redisCheck = await this.redis.healthCheck();

      const uptime = process.uptime();
      const responseTime = Date.now() - startTime;

      const status =
        dbCheck.status === 'unhealthy'
          ? 'unhealthy'
          : redisCheck.status === 'unhealthy' ||
              redisCheck.status === 'not_configured'
            ? 'degraded'
            : 'healthy';

      return {
        status,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        responseTime,
        services: {
          database: dbCheck,
          redis: redisCheck,
        },
      };
    } catch (error: any) {
      this.logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }
  }

  private async checkDatabase(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    message?: string;
  }> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return { status: 'healthy', latency, message: 'Database is responsive' };
    } catch (error: any) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'unhealthy',
        message: `Database health check failed: ${error.message}`,
      };
    }
  }
}
