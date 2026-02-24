import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns dashboard statistics',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            totalProducts: { type: 'number', example: 150 },
            totalOrders: { type: 'number', example: 500 },
            totalRevenue: { type: 'number', example: 25000000 },
            lowStockProducts: { type: 'number', example: 5 },
            pendingOrders: { type: 'number', example: 12 },
          },
        },
      },
    },
  })
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock products' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of products with low stock',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              sku: { type: 'string' },
              inventoryQuantity: { type: 'number' },
              lowStockThreshold: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getLowStockProducts() {
    return this.dashboardService.getLowStockProducts();
  }

  @Get('recent-orders')
  @ApiOperation({ summary: 'Get recent orders' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of recent orders',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              orderNumber: { type: 'string' },
              customerName: { type: 'string' },
              total: { type: 'number' },
              status: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  async getRecentOrders() {
    return this.dashboardService.getRecentOrders();
  }
}
