import { supabase, FUNCTIONS_URL } from '@/lib/supabase';
import type {
  Category,
  CreateCategoryDto,
  UpdateCategoryDto,
  Product,
  CreateProductDto,
  UpdateProductDto,
  Order,
  CreateOrderDto,
  UpdateOrderDto,
  PaginatedResponse,
  QueryParams,
  DashboardStats,
  LowStockProduct,
  RecentOrder,
  HealthCheckResponse,
  SettingsGroup,
  Setting,
  CreateSettingDto,
  BulkUpdateSettingsDto,
} from '@/types';

const API_URL = FUNCTIONS_URL;

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class ApiService {
  private async getValidToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new ApiError('Not authenticated', 401);
    }
    return session.access_token;
  }

  async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = await this.getValidToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      // Session expired — Supabase auto-refreshes, but force sign-out if it truly fails
      await supabase.auth.signOut();
      throw new ApiError('Session expired. Please log in again.', 401);
    }

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Request failed' }));
      throw new ApiError(
        error.message || `HTTP error ${response.status}`,
        response.status,
      );
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Health Check
  async checkHealth(): Promise<HealthCheckResponse> {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/health`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      },
    );

    if (!response.ok) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetch<DashboardStats>('/dashboard-stats?type=stats');
  }

  async getLowStockProducts(): Promise<LowStockProduct[]> {
    return this.fetch<LowStockProduct[]>('/dashboard-stats?type=low-stock');
  }

  async getRecentOrders(): Promise<RecentOrder[]> {
    return this.fetch<RecentOrder[]>('/dashboard-stats?type=recent-orders');
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.fetch<Category[]>('/categories-list');
  }

  async getCategory(id: string): Promise<Category> {
    return this.fetch<Category>(`/categories-list?id=${id}`);
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    return this.fetch<Category>('/categories-create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    return this.fetch<Category>(`/categories-update?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.fetch<void>(`/categories-delete?id=${id}`, { method: 'DELETE' });
  }

  // Products
  async getProducts(params?: QueryParams): Promise<PaginatedResponse<Product>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.fetch<PaginatedResponse<Product>>(
      `/products-list${query ? `?${query}` : ''}`,
    );
  }

  async getProduct(id: string): Promise<Product> {
    return this.fetch<Product>(`/products-get?id=${id}`);
  }

  async createProduct(data: CreateProductDto): Promise<Product> {
    return this.fetch<Product>('/products-create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: UpdateProductDto): Promise<Product> {
    return this.fetch<Product>(`/products-update?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.fetch<void>(`/products-delete?id=${id}`, { method: 'DELETE' });
  }

  async uploadProductImages(
    productId: string,
    images: File[],
  ): Promise<Product> {
    const token = await this.getValidToken();
    const formData = new FormData();
    images.forEach((image) => {
      formData.append('images', image);
    });

    const response = await fetch(`${API_URL}/products-upload-images?productId=${productId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Upload failed' }));
      throw new ApiError(error.message || 'Upload failed', response.status);
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Orders
  async getOrders(
    params?: QueryParams & { status?: string },
  ): Promise<PaginatedResponse<Order>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    return this.fetch<PaginatedResponse<Order>>(
      `/orders-list-admin${query ? `?${query}` : ''}`,
    );
  }

  async getOrder(id: string): Promise<Order> {
    return this.fetch<Order>(`/orders-list-admin?id=${id}`);
  }

  async createOrder(data: CreateOrderDto): Promise<Order> {
    return this.fetch<Order>('/checkout-create-order', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: UpdateOrderDto): Promise<Order> {
    return this.fetch<Order>(`/orders-update?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async sendPushNotification(title: string, body: string): Promise<void> {
    return this.fetch<void>('/notifications-push', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
  }

  // Settings
  async getSettings(): Promise<SettingsGroup> {
    return this.fetch<SettingsGroup>('/settings-list');
  }

  async getSettingsByCategory(category: string): Promise<Record<string, unknown>> {
    return this.fetch<Record<string, unknown>>(`/settings-list?category=${category}`);
  }

  async getSetting(key: string): Promise<Setting> {
    return this.fetch<Setting>(`/settings-list?key=${key}`);
  }

  async upsertSetting(data: CreateSettingDto): Promise<Setting> {
    return this.fetch<Setting>('/settings-upsert', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkUpdateSettings(data: BulkUpdateSettingsDto): Promise<Setting[]> {
    return this.fetch<Setting[]>('/settings-bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSetting(key: string, value: unknown): Promise<Setting> {
    return this.fetch<Setting>(`/settings-update?key=${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async deleteSetting(key: string): Promise<void> {
    return this.fetch<void>(`/settings-delete?key=${key}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
export { ApiError };
