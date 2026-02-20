// API Configuration - Use relative URLs for the proxy
const API_BASE_URL = '/api/v1';

export const API_ENDPOINTS = {
  // Products
  products: `${API_BASE_URL}/products`,
  product: (id: string) => `${API_BASE_URL}/products/${id}`,
  productBySlug: (slug: string) => `${API_BASE_URL}/products/slug/${slug}`,

  // Categories
  categories: `${API_BASE_URL}/categories`,
  category: (id: string) => `${API_BASE_URL}/categories/${id}`,

  // Orders
  orders: `${API_BASE_URL}/orders`,
  order: (id: string) => `${API_BASE_URL}/orders/${id}`,

  // WhatsApp
  whatsappLink: (orderId: string) => `${API_BASE_URL}/notifications/whatsapp/${orderId}`,
} as const;

// Generic fetch helper
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An error occurred',
    }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.data ?? data;
}

// API Functions
export const api = {
  // Products
  async getProducts(query?: Record<string, any>) {
    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const url = `${API_ENDPOINTS.products}${params.toString() ? `?${params}` : ''}`;
    return apiFetch<{
      data: import('@/types').Product[];
      meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>(url);
  },

  async getProduct(id: string) {
    return apiFetch<import('@/types').Product>(API_ENDPOINTS.product(id));
  },

  async getProductBySlug(slug: string) {
    return apiFetch<import('@/types').Product>(API_ENDPOINTS.productBySlug(slug));
  },

  // Categories
  async getCategories() {
    return apiFetch<import('@/types').Category[]>(API_ENDPOINTS.categories);
  },

  async getCategory(id: string) {
    return apiFetch<import('@/types').Category>(API_ENDPOINTS.category(id));
  },

  // Orders
  async createOrder(data: import('@/types').CreateOrderDto) {
    return apiFetch<import('@/types').Order>(API_ENDPOINTS.orders, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getOrder(id: string) {
    return apiFetch<import('@/types').Order>(API_ENDPOINTS.order(id));
  },

  // WhatsApp
  async getWhatsAppLink(orderId: string) {
    return apiFetch<{ url: string; message: string }>(
      API_ENDPOINTS.whatsappLink(orderId),
    );
  },
};
