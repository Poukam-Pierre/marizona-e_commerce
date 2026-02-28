// Auth Types
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF';
  isActive?: boolean;
  avatar?: string;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AdminUser;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  parent?: Category;
  children?: Category[];
  _count?: {
    products: number;
    children: number;
  };
}

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  parentId?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

// Product Types
export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  order: number;
  isPrimary: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
  price: number;
  comparePrice?: number;
  inventoryQuantity: number;
  weight?: number;
  image?: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string;
  type: 'PHYSICAL' | 'DIGITAL';
  price: number;
  comparePrice: number | null;
  costPrice: number | null;
  inventoryQuantity: number;
  inventoryTracked: boolean;
  lowStockThreshold: number;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  downloadUrl: string | null;
  downloadLimit: number | null;
  downloadExpiry: number | null;
  ownerName: string | null;
  ownerWhatsapp: string | null;
  categoryId: string;
  image: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  viewCount: number;
  soldCount: number;
  rating: number | null;
  reviewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  images: ProductImage[];
  variants?: ProductVariant[];
}

export interface IVariant {
  sku: string;
  name: string;
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
  price: number;
  comparePrice?: number;
  inventoryQuantity: number;
  weight?: number;
  image: string;
  isActive?: boolean;
}

export interface IImage {
  url: string;
  alt?: string;
  isPrimary: boolean;
  order?: number;
}
export interface CreateProductDto {
  sku: string;
  name: string;
  slug?: string;
  description: string;
  type: 'PHYSICAL' | 'DIGITAL';
  price: number;
  comparePrice?: number;
  costPrice?: number;
  inventoryQuantity: number;
  inventoryTracked?: boolean;
  lowStockThreshold?: number;
  weight?: number;
  downloadUrl?: string;
  downloadLimit?: number;
  downloadExpiry?: number;
  ownerName?: string;
  ownerWhatsapp?: string;
  categoryId: string;
  metaTitle?: string;
  metaDescription?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  images: IImage[];
  variants?: IVariant[];
}

export type UpdateProductDto = Partial<CreateProductDto>;

// Order Types
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  variantId?: string;
  variant?: ProductVariant;
  quantity: number;
  price: number;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerWhatsapp?: string;
  status: OrderStatus;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  notes?: string;
  shippingAddress?: {
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderDto {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerWhatsapp?: string;
  items: { productId: string; variantId?: string; quantity: number }[];
  notes?: string;
  shippingAddress?: Order['shippingAddress'];
}

export interface UpdateOrderDto {
  status?: OrderStatus;
  notes?: string;
}

// Pagination Types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: string | number | boolean | undefined;
}

// Dashboard Types
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

// Health Check Types
export interface HealthCheckResponse {
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
