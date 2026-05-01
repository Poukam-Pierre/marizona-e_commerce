// API Types
export interface Product {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description: string | null;
  type: 'PHYSICAL' | 'DIGITAL';
  price: number;
  comparePrice: number | null;
  inventoryQuantity: number;
  inventoryTracked: boolean;
  lowStockThreshold: number;
  downloadUrl: string | null;
  downloadLimit: number | null;
  downloadExpiry: string | null;
  ownerName: string | null;
  ownerWhatsapp: string | null;
  categoryId: string | null;
  image: string | null;
  isActive: boolean;
  isFeatured: boolean;
  viewCount: number;
  soldCount: number;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    order: number;
    isPrimary: boolean;
  }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    price: number;
    comparePrice: number | null;
    inventoryQuantity: number;
    option1Name: string | null;
    option1Value: string | null;
    option2Name: string | null;
    option2Value: string | null;
    option3Name: string | null;
    option3Value: string | null;
    weight: number | null;
    image: string | null;
    isActive: boolean;
  }>;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  /** Phone masked to last 4 digits */
  maskedPhone: string;
  shippingCity: string;
  shippingProvince: string;
  subtotal: number;
  discount: number;
  shippingCost: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
  completedAt: string | null;
  deliveredAt: string | null;
  /** Expiry of the lookup token — shown on tracking page */
  lookupTokenExpiry: string | null;
  items: OrderItem[];
}

export interface OrderItem {
  id: string;
  productId: string | null;
  productSku: string;
  productName: string;
  productImage: string | null;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  productType: 'PHYSICAL' | 'DIGITAL';
  /** Computed by API based on payment + status + expiry + limit */
  downloadEligible: boolean;
  downloadBlockedReason:
    | 'NOT_PAID'
    | 'ORDER_CANCELLED'
    | 'LINK_EXPIRED'
    | 'LIMIT_REACHED'
    | null;
  downloadCount: number;
  downloadLimit: number | null;
  downloadExpiry: string | null;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIAL';

export type PaymentMethod =
  | 'WHATSAPP'
  | 'BANK_TRANSFER'
  | 'CREDIT_CARD'
  | 'E_WALLET'
  | 'COD';

// API Response Types
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  timestamp: string;
  path: string;
}

export interface PaginatedResult<T> {
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

// Query Types
export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: 'PHYSICAL' | 'DIGITAL';
  categoryId?: string;
  isActive?: boolean;
  isFeatured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Returned ONCE at order creation — raw token, never persisted by server */
export interface OrderCreatedResponse extends Omit<Order, 'maskedPhone' | 'confirmedAt' | 'paidAt' | 'completedAt' | 'deliveredAt' | 'lookupTokenExpiry'> {
  customerName: string;
  customerPhone: string;
  lookupToken: string;
  lookupTokenExpiry: string;
}

// Create Order DTO
export interface CreateOrderDto {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  customerWhatsapp?: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  customerNotes?: string;
  shippingCost?: number;
}

// Cart Types
export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  productImage: string | null;
  productType: 'PHYSICAL' | 'DIGITAL';
  price: number;
  quantity: number;
  variantId?: string;
  variantName?: string;
  ownerWhatsapp?: string | null;
}
