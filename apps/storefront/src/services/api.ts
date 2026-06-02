// Supabase Edge Functions base URL and anon key
const FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Generic fetch helper — adds the required apikey header for Edge Functions
export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: 'An error occurred',
    }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  // Edge Functions wrap payload in { data: ... }; fall back to raw body
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
    const url = `${FUNCTIONS_URL}/products-list${params.toString() ? `?${params}` : ''}`;
    // products-list returns { data: [...], meta: {...} } at the top level.
    // We must NOT use apiFetch here (which strips meta via data.data unwrap).
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: 'An error occurred' }));
      throw new Error(err.message || err.error || `HTTP error! status: ${response.status}`);
    }
    return response.json() as Promise<{
      data: import('@/types').Product[];
      meta: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>;
  },

  async getProduct(id: string) {
    return apiFetch<import('@/types').Product>(
      `${FUNCTIONS_URL}/products-get?id=${encodeURIComponent(id)}`,
    );
  },

  async getProductBySlug(slug: string) {
    return apiFetch<import('@/types').Product>(
      `${FUNCTIONS_URL}/products-get?slug=${encodeURIComponent(slug)}`,
    );
  },

  // Categories
  async getCategories() {
    return apiFetch<import('@/types').Category[]>(`${FUNCTIONS_URL}/categories-list`);
  },

  async getCategory(id: string) {
    return apiFetch<import('@/types').Category>(
      `${FUNCTIONS_URL}/categories-list?id=${encodeURIComponent(id)}`,
    );
  },

  // Orders
  async createOrder(data: import('@/types').CreateOrderDto) {
    return apiFetch<import('@/types').OrderCreatedResponse>(
      `${FUNCTIONS_URL}/checkout-create-order`,
      { method: 'POST', body: JSON.stringify(data) },
    );
  },

  async getOrder(id: string, token: string) {
    return apiFetch<import('@/types').Order>(
      `${FUNCTIONS_URL}/orders-public-get?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
    );
  },

  // WhatsApp
  async getWhatsAppLink(orderId: string) {
    return apiFetch<{ url: string; message: string }>(
      `${FUNCTIONS_URL}/orders-whatsapp-link?orderId=${encodeURIComponent(orderId)}`,
    );
  },

  // Ratings — not yet migrated to Edge Functions; no-op to avoid 503s
  async rateProduct(_id: string, _rating: number) {
    return { rating: 0, reviewCount: 0 };
  },
};
