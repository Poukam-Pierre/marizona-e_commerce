import { useAuthStore } from '@/stores/auth-store';
import type {
  LoginCredentials,
  LoginResponse,
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

const API_URL = '/api/v1';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

class ApiService {
  private refreshPromise: Promise<string> | null = null;

  private getAccessToken(): string | null {
    return useAuthStore.getState().accessToken;
  }

  private getRefreshToken(): string | null {
    return useAuthStore.getState().refreshToken;
  }

  private setAccessToken(token: string): void {
    useAuthStore.getState().setAccessToken(token);
  }

  private async refreshToken(): Promise<string> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new ApiError('No refresh token', 401);
    }

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      useAuthStore.getState().logout();
      throw new ApiError('Token refresh failed', 401);
    }

    const data = await response.json();
    const newAccessToken = data.data.accessToken;
    this.setAccessToken(newAccessToken);
    return newAccessToken;
  }

  private async getValidToken(): Promise<string> {
    const token = this.getAccessToken();
    if (!token) {
      throw new ApiError('Not authenticated', 401);
    }
    return token;
  }

  async fetch<T>(
    endpoint: string,
    options: RequestInit = {},
    retry = true,
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

    if (response.status === 401 && retry) {
      // Try to refresh token
      if (!this.refreshPromise) {
        this.refreshPromise = this.refreshToken();
      }

      try {
        const newToken = await this.refreshPromise;
        this.refreshPromise = null;

        // Retry with new token
        const retryResponse = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });

        if (!retryResponse.ok) {
          const error = await retryResponse
            .json()
            .catch(() => ({ message: 'Request failed' }));
          throw new ApiError(
            error.message || `HTTP error ${retryResponse.status}`,
            retryResponse.status,
          );
        }

        const data = await retryResponse.json();
        return data.data ?? data;
      } catch (error) {
        this.refreshPromise = null;
        throw error;
      }
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
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Auth
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ message: 'Login failed' }));
      throw new ApiError(error.message || 'Login failed', response.status);
    }

    const data = await response.json();
    return data.data;
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.fetch<DashboardStats>('/dashboard/stats');
  }

  async getLowStockProducts(): Promise<LowStockProduct[]> {
    return this.fetch<LowStockProduct[]>('/dashboard/low-stock');
  }

  async getRecentOrders(): Promise<RecentOrder[]> {
    return this.fetch<RecentOrder[]>('/dashboard/recent-orders');
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.fetch<Category[]>('/categories');
  }

  async getCategory(id: string): Promise<Category> {
    return this.fetch<Category>(`/categories/${id}`);
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    return this.fetch<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: UpdateCategoryDto): Promise<Category> {
    return this.fetch<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string): Promise<void> {
    return this.fetch<void>(`/categories/${id}`, { method: 'DELETE' });
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
      `/products${query ? `?${query}` : ''}`,
    );
  }

  async getProduct(id: string): Promise<Product> {
    return this.fetch<Product>(`/products/${id}`);
  }

  async createProduct(data: CreateProductDto): Promise<Product> {
    return this.fetch<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: UpdateProductDto): Promise<Product> {
    return this.fetch<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string): Promise<void> {
    return this.fetch<void>(`/products/${id}`, { method: 'DELETE' });
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

    const response = await fetch(`${API_URL}/products/${productId}/images`, {
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
      `/orders${query ? `?${query}` : ''}`,
    );
  }

  async getOrder(id: string): Promise<Order> {
    return this.fetch<Order>(`/orders/${id}`);
  }

  async createOrder(data: CreateOrderDto): Promise<Order> {
    return this.fetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: UpdateOrderDto): Promise<Order> {
    return this.fetch<Order>(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Notifications
  async sendPushNotification(title: string, body: string): Promise<void> {
    return this.fetch<void>('/notifications/push', {
      method: 'POST',
      body: JSON.stringify({ title, body }),
    });
  }

  // Settings
  async getSettings(): Promise<SettingsGroup> {
    return this.fetch<SettingsGroup>('/settings');
  }

  async getSettingsByCategory(category: string): Promise<Record<string, any>> {
    return this.fetch<Record<string, any>>(`/settings/category/${category}`);
  }

  async getSetting(key: string): Promise<Setting> {
    return this.fetch<Setting>(`/settings/${key}`);
  }

  async upsertSetting(data: CreateSettingDto): Promise<Setting> {
    return this.fetch<Setting>('/settings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async bulkUpdateSettings(data: BulkUpdateSettingsDto): Promise<Setting[]> {
    return this.fetch<Setting[]>('/settings/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSetting(key: string, value: any): Promise<Setting> {
    return this.fetch<Setting>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  async deleteSetting(key: string): Promise<void> {
    return this.fetch<void>(`/settings/${key}`, { method: 'DELETE' });
  }
}

export const api = new ApiService();
export { ApiError };
