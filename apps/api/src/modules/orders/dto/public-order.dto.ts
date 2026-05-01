import { OrderStatus, PaymentStatus, ProductType } from '@prisma/client';

/**
 * Public-facing order item — no raw downloadUrl exposed.
 * The download is served through the proxy endpoint only.
 */
export class PublicOrderItemDto {
  id: string;
  productName: string;
  productImage: string | null;
  variantName: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productType: ProductType;
  /** True when the buyer is currently eligible to download this item */
  downloadEligible: boolean;
  /** Reason the download is blocked, when not eligible */
  downloadBlockedReason:
    | 'NOT_PAID'
    | 'ORDER_CANCELLED'
    | 'LINK_EXPIRED'
    | 'LIMIT_REACHED'
    | null;
  downloadCount: number;
  downloadLimit: number | null;
  downloadExpiry: Date | null;
}

/**
 * Public-facing order — minimum necessary data for customer tracking.
 * Excluded: full email, full phone, adminNotes, paymentId, billing address,
 *           raw downloadUrl, lookupToken.
 */
export class PublicOrderDto {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  /** Phone masked to last 4 digits for identity confirmation only */
  maskedPhone: string;
  shippingCity: string;
  shippingProvince: string;
  createdAt: Date;
  confirmedAt: Date | null;
  paidAt: Date | null;
  completedAt: Date | null;
  deliveredAt: Date | null;
  lookupTokenExpiry: Date | null;
  items: PublicOrderItemDto[];
}
