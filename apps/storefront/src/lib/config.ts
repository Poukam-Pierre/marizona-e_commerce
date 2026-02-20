// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1';

// API Endpoints
export const API_ENDPOINTS = {
  // Products
  PRODUCTS: '/products',
  PRODUCT: (id: string) => `/products/${id}`,
  PRODUCT_BY_SLUG: (slug: string) => `/products/slug/${slug}`,
  
  // Categories
  CATEGORIES: '/categories',
  CATEGORY: (id: string) => `/categories/${id}`,
  
  // Orders
  ORDERS: '/orders',
  ORDER: (id: string) => `/orders/${id}`,
  
  // Notifications
  WHATSAPP_LINK: (orderId: string) => `/notifications/whatsapp/${orderId}`,
} as const;

// App Configuration
export const APP_CONFIG = {
  name: 'ShopNx',
  description: 'Professional E-Commerce Store',
  currency: 'IDR',
  currencySymbol: 'Rp',
  defaultPageSize: 12,
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+6281234567890',
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  CART: 'shopnx_cart',
  THEME: 'shopnx_theme',
} as const;
