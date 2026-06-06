import { OrderStatus } from '@prisma/client';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  lowStockProducts: number;
  pendingOrders: number;
}

export interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  inventoryQuantity: number;
  lowStockThreshold: number;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
}
