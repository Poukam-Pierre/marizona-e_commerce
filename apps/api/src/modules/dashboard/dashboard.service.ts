import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { OrderStatus } from '@prisma/client';
import {
  DashboardStats,
  LowStockProduct,
  RecentOrder,
} from './dto/dashboard.dto';

const CACHE_KEY_PREFIX = 'dashboard';
const CACHE_TTL = 60; // 1 minute

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getDashboardStats(): Promise<DashboardStats> {
    const cacheKey = `${CACHE_KEY_PREFIX}:stats`;

    // Try to get from cache
    const cached = await this.redisService.get<DashboardStats>(cacheKey);
    if (cached) {
      this.logger.debug('Dashboard stats retrieved from cache');
      return cached;
    }

    try {
      // Get all stats in parallel
      const [
        totalProducts,
        totalOrders,
        revenueData,
        lowStockProducts,
        pendingOrders,
      ] = await Promise.all([
        // Total active products
        this.prisma.product.count({
          where: {
            deletedAt: null,
            isActive: true,
          },
        }),
        // Total orders
        this.prisma.order.count(),

        // Total revenue from completed/paid orders
        this.prisma.order.aggregate({
          where: {
            status: {
              in: [
                OrderStatus.CONFIRMED,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
                OrderStatus.DELIVERED,
                OrderStatus.COMPLETED,
              ],
            },
          },
          _sum: {
            total: true,
          },
        }),

        // Low stock products count
        this.prisma.product.count({
          where: {
            deletedAt: null,
            isActive: true,
            inventoryTracked: true,
            inventoryQuantity: {
              lte: this.prisma.product.fields.lowStockThreshold,
            },
          },
        }),

        // Pending orders count
        this.prisma.order.count({
          where: {
            status: OrderStatus.PENDING,
          },
        }),
      ]);

      const stats: DashboardStats = {
        totalProducts,
        totalOrders,
        totalRevenue: revenueData._sum.total || 0,
        lowStockProducts,
        pendingOrders,
      };

      // Cache the result
      await this.redisService.set(cacheKey, stats, CACHE_TTL);

      this.logger.log('Dashboard stats calculated and cached');
      return stats;
    } catch (error) {
      this.logger.error('Failed to get dashboard stats', error);
      throw error;
    }
  }

  async getLowStockProducts(): Promise<LowStockProduct[]> {
    const cacheKey = `${CACHE_KEY_PREFIX}:low-stock`;

    // Try to get from cache
    const cached = await this.redisService.get<LowStockProduct[]>(cacheKey);
    if (cached) {
      this.logger.debug('Low stock products retrieved from cache');
      return cached;
    }

    try {
      // Get products where inventory is at or below the low stock threshold
      const products = await this.prisma.product.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          inventoryTracked: true,
          inventoryQuantity: {
            lte: this.prisma.product.fields.lowStockThreshold,
          },
        },
        orderBy: {
          inventoryQuantity: 'asc',
        },
        take: 10,
        select: {
          id: true,
          name: true,
          sku: true,
          inventoryQuantity: true,
          lowStockThreshold: true,
        },
      });

      // Cache the result
      await this.redisService.set(cacheKey, products, CACHE_TTL);

      this.logger.log(`Found ${products.length} low stock products`);
      return products;
    } catch (error) {
      this.logger.error('Failed to get low stock products', error);
      throw error;
    }
  }

  async getRecentOrders(): Promise<RecentOrder[]> {
    const cacheKey = `${CACHE_KEY_PREFIX}:recent-orders`;

    // Try to get from cache
    const cached = await this.redisService.get<RecentOrder[]>(cacheKey);
    if (cached) {
      this.logger.debug('Recent orders retrieved from cache');
      return cached;
    }

    try {
      // Get the 10 most recent orders
      const orders = await this.prisma.order.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          total: true,
          status: true,
          createdAt: true,
        },
      });

      // Transform to match the expected format
      const recentOrders: RecentOrder[] = orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      }));

      // Cache the result
      await this.redisService.set(cacheKey, recentOrders, CACHE_TTL);

      this.logger.log(`Found ${recentOrders.length} recent orders`);
      return recentOrders;
    } catch (error) {
      this.logger.error('Failed to get recent orders', error);
      throw error;
    }
  }
}
