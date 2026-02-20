import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(@Optional() private configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService?.get<string>('redis.url');

    if (!redisUrl) {
      this.logger.warn(
        'Redis URL not configured. Caching will be disabled.',
      );
      return;
    }

    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('✅ Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.logger.error(`Redis error: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.logger.warn('Redis connection closed');
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error: any) {
      this.logger.warn(
        `Failed to connect to Redis: ${error.message}. Caching will be disabled.`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) return null;

    try {
      const data = await this.client!.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error: any) {
      this.logger.error(`Redis GET error for key ${key}: ${error.message}`);
      return null;
    }
  }

  /**
   * Set a value in cache
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const data = JSON.stringify(value);
      if (ttl) {
        await this.client!.setex(key, ttl, data);
      } else {
        await this.client!.set(key, data);
      }
    } catch (error: any) {
      this.logger.error(`Redis SET error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.client!.del(key);
    } catch (error: any) {
      this.logger.error(`Redis DEL error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
    } catch (error: any) {
      this.logger.error(
        `Redis DEL PATTERN error for pattern ${pattern}: ${error.message}`,
      );
    }
  }

  /**
   * Get or set a value with a callback
   */
  async getOrSet<T>(
    key: string,
    callback: () => Promise<T>,
    ttl = 300, // 5 minutes default
  ): Promise<T> {
    // If Redis is not available, just call the callback
    if (!this.isAvailable()) {
      return callback();
    }

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await callback();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(
    key: string,
    ttl: number,
  ): Promise<{ count: number; remaining: number }> {
    if (!this.isAvailable()) {
      return { count: 0, remaining: Infinity };
    }

    try {
      const count = await this.client!.incr(key);
      if (count === 1) {
        await this.client!.expire(key, ttl);
      }
      const ttlRemaining = await this.client!.ttl(key);
      return { count, remaining: ttlRemaining };
    } catch (error: any) {
      this.logger.error(
        `Redis rate limit error for key ${key}: ${error.message}`,
      );
      return { count: 0, remaining: Infinity };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; latency?: number }> {
    if (!this.isAvailable()) {
      return { status: 'disconnected' };
    }

    try {
      const start = Date.now();
      await this.client!.ping();
      return { status: 'healthy', latency: Date.now() - start };
    } catch {
      return { status: 'unhealthy' };
    }
  }
}
