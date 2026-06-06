import { createHash, randomBytes } from 'crypto';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CurrencyService } from '../../common/services/currency.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import {
  PublicOrderDto,
  PublicOrderItemDto,
} from './dto/public-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  /** Forward-only state machine — terminal states have empty arrays.
   *  CONFIRMED → COMPLETED is allowed as a direct shortcut for digital-only orders.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    OrderStatus,
    OrderStatus[]
  > = {
    [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]:  [OrderStatus.PROCESSING, OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]:    [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]:  [OrderStatus.COMPLETED, OrderStatus.REFUNDED],
    [OrderStatus.COMPLETED]:  [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]:  [],
    [OrderStatus.REFUNDED]:   [],
  };

  /** Token TTL: 30 days in milliseconds */
  private static readonly TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async findAll(query: QueryOrderDto): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      customerId,
      search,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customerName: { contains: search } },
        { customerEmail: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Execute queries
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, image: true },
              },
            },
          },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: orders,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsappNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                image: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async create(dto: CreateOrderDto) {
    // Validate products and get prices
    const productIds = dto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
        isActive: true,
      },
      include: {
        variants: dto.items.some((i) => i.variantId)
          ? { where: { isActive: true } }
          : false,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'One or more products not found or inactive',
      );
    }

    // Build order items with price snapshots
    const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    let subtotal = 0;

    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }

      let unitPrice = product.price;
      let variantName: string | undefined;

      if (item.variantId) {
        const variant = product.variants?.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new BadRequestException(`Variant ${item.variantId} not found`);
        }
        unitPrice = variant.price;
        variantName = variant.name;
      }

      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        product: { connect: { id: product.id } },
        productSku: product.sku,
        productName: product.name,
        productImage: product.image,
        variantId: item.variantId,
        variantName,
        unitPrice,
        totalPrice,
        quantity: item.quantity,
        productType: product.type,
        downloadUrl: product.downloadUrl,
        downloadLimit: product.downloadLimit,
      });

      // Check inventory for physical products
      if (product.type === 'PHYSICAL' && product.inventoryTracked) {
        const availableStock = item.variantId
          ? product.variants?.find((v) => v.id === item.variantId)
              ?.inventoryQuantity || 0
          : product.inventoryQuantity;

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${availableStock}`,
          );
        }
      }
    }

    // Generate order number and secure lookup token
    const orderNumber = await this.generateOrderNumber();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const tokenExpiry = new Date(Date.now() + OrdersService.TOKEN_TTL_MS);

    // Create order
    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        customerId: dto.customerId,
        customerName: dto.customerName,
        customerEmail: dto.customerEmail,
        customerPhone: dto.customerPhone,
        customerWhatsapp: dto.customerWhatsapp,
        shippingName: dto.shippingName,
        shippingPhone: dto.shippingPhone,
        shippingAddress: dto.shippingAddress,
        shippingCity: dto.shippingCity,
        shippingProvince: dto.shippingProvince,
        shippingPostalCode: dto.shippingPostalCode,
        shippingCountry: dto.shippingCountry || 'Indonesia',
        subtotal,
        shippingCost: dto.shippingCost ?? 0,
        total: subtotal + (dto.shippingCost ?? 0),
        couponCode: dto.couponCode,
        customerNotes: dto.customerNotes,
        lookupToken: tokenHash,
        lookupTokenExpiry: tokenExpiry,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, image: true },
            },
          },
        },
      },
    });

    // Decrease inventory for physical products
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product?.type === 'PHYSICAL' && product.inventoryTracked) {
        await this.decreaseInventory(
          item.productId,
          item.variantId,
          item.quantity,
        );
      }
    }

    this.logger.log(`Order created: ${order.orderNumber}`);
    // Return raw token ONCE — it is never stored and cannot be re-read from DB
    return { ...order, lookupToken: rawToken, lookupTokenExpiry: tokenExpiry };
  }

  async update(id: string, dto: UpdateOrderDto) {
    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Prepare update data
    const updateData: Prisma.OrderUpdateInput = {};

    if (dto.status) {
      // Enforce forward-only state machine
      const allowed =
        OrdersService.ALLOWED_TRANSITIONS[existingOrder.status] ?? [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Transition from ${existingOrder.status} to ${dto.status} is not allowed`,
        );
      }

      updateData.status = dto.status;

      // Update timestamps based on status
      if (dto.status === OrderStatus.CONFIRMED && !existingOrder.confirmedAt) {
        updateData.confirmedAt = new Date();
      }
      if (dto.status === OrderStatus.SHIPPED && !existingOrder.shippedAt) {
        updateData.shippedAt = new Date();
      }
      if (dto.status === OrderStatus.DELIVERED && !existingOrder.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
      if (dto.status === OrderStatus.COMPLETED && !existingOrder.completedAt) {
        updateData.completedAt = new Date();
      }
      if (dto.status === OrderStatus.CANCELLED && !existingOrder.cancelledAt) {
        updateData.cancelledAt = new Date();
      }
      if (dto.status === OrderStatus.REFUNDED && !existingOrder.refundedAt) {
        updateData.refundedAt = new Date();
      }
    }

    if (dto.paymentStatus) {
      updateData.paymentStatus = dto.paymentStatus;

      if (dto.paymentStatus === PaymentStatus.PAID && !existingOrder.paidAt) {
        updateData.paidAt = new Date();
      }
    }

    if (dto.paymentId) {
      updateData.paymentId = dto.paymentId;
    }

    if (dto.trackingNumber) {
      updateData.trackingNumber = dto.trackingNumber;
    }

    if (dto.shippingProvider) {
      updateData.shippingProvider = dto.shippingProvider;
    }

    if (dto.adminNotes) {
      updateData.adminNotes = dto.adminNotes;
    }

    // Update order
    const order = await this.prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, image: true },
            },
          },
        },
      },
    });

    this.logger.log(`Order updated: ${order.orderNumber}`);

    // Auto-complete digital-only orders the moment they are both CONFIRMED and PAID
    const result = await this.tryAutoCompleteDigitalOrder(order);
    return result;
  }

  /**
   * If an order contains ONLY digital items AND its current status is CONFIRMED
   * AND payment is PAID, automatically advance it to COMPLETED.
   * This is idempotent — safe to call on every update.
   */
  private async tryAutoCompleteDigitalOrder(order: any): Promise<any> {
    if (
      order.status !== OrderStatus.CONFIRMED ||
      order.paymentStatus !== PaymentStatus.PAID
    ) {
      return order;
    }

    const allDigital =
      Array.isArray(order.items) &&
      order.items.length > 0 &&
      order.items.every((i: any) => i.productType === 'DIGITAL');

    if (!allDigital) return order;

    this.logger.log(
      `Auto-completing digital order ${order.orderNumber} (all items digital + paid)`,
    );

    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.COMPLETED,
        completedAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, image: true } },
          },
        },
      },
    });
  }

  async remove(id: string) {
    // Check if order exists
    const existingOrder = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    // Only allow cancellation of pending orders
    if (existingOrder.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Only pending orders can be cancelled');
    }

    // Restore inventory
    for (const item of existingOrder.items) {
      if (item.productId) {
        await this.increaseInventory(
          item.productId,
          item.variantId,
          item.quantity,
        );
      }
    }

    // Cancel order
    const order = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    this.logger.log(`Order cancelled: ${order.orderNumber}`);
    return { message: 'Order cancelled successfully' };
  }

  async generateWhatsAppLink(orderId: string): Promise<{ url: string }> {
    const order = await this.findOne(orderId);

    // Get WhatsApp number (prefer owner's WhatsApp if available)
    const phoneNumber = order.customerWhatsapp || order.customerPhone;
    if (!phoneNumber) {
      throw new BadRequestException(
        'No WhatsApp number available for this order',
      );
    }

    // Format phone number (remove non-digits)
    const formattedPhone = phoneNumber.replace(/\D/g, '');

    // Build message
    const { code } = await this.currencyService.getConfig();
    const fmt = (price: number) => this.currencyService.format(price, code);

    const items = order.items
      .map(
        (item) =>
          `- ${item.productName} x${item.quantity} = ${fmt(item.totalPrice)}`,
      )
      .join('\n');

    const message = `Hello, I would like to place an order:

📄 *Order ID:* ${order.orderNumber}

📦 *Order Items:*
${items}

💰 *Subtotal:* ${fmt(order.subtotal)}
🚚 *Shipping:* ${fmt(order.shippingCost)}
💰 *Total:* ${fmt(order.total)}

👤 *Name:* ${order.shippingName}
📱 *Phone:* ${order.shippingPhone}
📍 *Shipping Address:*
${order.shippingAddress}
${order.shippingCity}, ${order.shippingProvince} ${order.shippingPostalCode}

${order.customerNotes ? `📝 *Notes:* ${order.customerNotes}` : ''}

Please confirm my order. Thank you! 🙏`;

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    return { url };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC ORDER TRACKING  (token-protected)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Returns a scoped public view of an order.
   * Always returns a generic 404 on any failure to prevent order enumeration.
   */
  async findOnePublic(id: string, rawToken: string): Promise<PublicOrderDto> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const order = await this.prisma.order.findFirst({
      where: { id, lookupToken: tokenHash },
      include: { items: { orderBy: { createdAt: 'asc' } } },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.lookupTokenExpiry && order.lookupTokenExpiry < new Date()) {
      // Expired tokens return the same generic 404 to prevent fishing
      throw new NotFoundException('Order not found');
    }

    return this.mapToPublicOrderDto(order);
  }

  /**
   * Verifies eligibility then atomically increments downloadCount.
   * Returns the download URL so the controller can issue a 302 redirect.
   */
  async processDownload(
    orderId: string,
    itemId: string,
    rawToken: string,
  ): Promise<{ downloadUrl: string }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, lookupToken: tokenHash },
      include: { items: true },
    });

    if (!order || (order.lookupTokenExpiry && order.lookupTokenExpiry < new Date())) {
      throw new NotFoundException('Order not found');
    }

    const item = order.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundException('Order item not found');
    }

    if (item.productType !== 'DIGITAL') {
      throw new BadRequestException('Item is not a digital product');
    }

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED
    ) {
      throw new ForbiddenException({ reason: 'ORDER_CANCELLED' });
    }

    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new ForbiddenException({ reason: 'NOT_PAID' });
    }

    if (item.downloadExpiry && item.downloadExpiry < new Date()) {
      throw new ForbiddenException({ reason: 'LINK_EXPIRED' });
    }

    if (
      item.downloadLimit !== null &&
      item.downloadCount >= item.downloadLimit
    ) {
      throw new ForbiddenException({ reason: 'LIMIT_REACHED' });
    }

    if (!item.downloadUrl) {
      throw new BadRequestException(
        'No download URL configured for this item',
      );
    }

    // Atomic increment — prevents race conditions on concurrent requests
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { downloadCount: { increment: 1 } },
    });

    this.logger.log(
      `Download served: order=${order.orderNumber} item=${itemId}`,
    );

    return { downloadUrl: item.downloadUrl };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private mapToPublicOrderDto(order: any): PublicOrderDto {
    const isPaid = order.paymentStatus === PaymentStatus.PAID;
    const isRevoked =
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REFUNDED;

    const items: PublicOrderItemDto[] = order.items.map((item: any) => {
      const isDigital = item.productType === 'DIGITAL';
      let downloadEligible = false;
      let downloadBlockedReason: PublicOrderItemDto['downloadBlockedReason'] =
        null;

      if (isDigital) {
        if (isRevoked) {
          downloadBlockedReason = 'ORDER_CANCELLED';
        } else if (!isPaid) {
          downloadBlockedReason = 'NOT_PAID';
        } else if (
          item.downloadExpiry &&
          new Date(item.downloadExpiry) < new Date()
        ) {
          downloadBlockedReason = 'LINK_EXPIRED';
        } else if (
          item.downloadLimit !== null &&
          item.downloadCount >= item.downloadLimit
        ) {
          downloadBlockedReason = 'LIMIT_REACHED';
        } else {
          downloadEligible = true;
        }
      }

      return {
        id: item.id,
        productName: item.productName,
        productImage: item.productImage,
        variantName: item.variantName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        productType: item.productType,
        downloadEligible,
        downloadBlockedReason,
        downloadCount: item.downloadCount,
        downloadLimit: item.downloadLimit,
        downloadExpiry: item.downloadExpiry,
      } satisfies PublicOrderItemDto;
    });

    // Mask phone — expose last 4 digits only
    const phone = order.customerPhone || '';
    const maskedPhone =
      phone.length > 4
        ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`
        : phone;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      maskedPhone,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
      deliveredAt: order.deliveredAt,
      lookupTokenExpiry: order.lookupTokenExpiry,
      items,
    } satisfies PublicOrderDto;
  }

  private async generateOrderNumber(): Promise<string> {    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of orders today
    const todayStart = new Date(date.setHours(0, 0, 0, 0));
    const todayEnd = new Date(date.setHours(23, 59, 59, 999));

    const count = await this.prisma.order.count({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `ORD-${dateStr}-${sequence}`;
  }

  private async decreaseInventory(
    productId: string,
    variantId: string | undefined,
    quantity: number,
  ) {
    if (variantId) {
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { inventoryQuantity: { decrement: quantity } },
      });
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { inventoryQuantity: { decrement: quantity } },
    });

    // Create inventory movement record
    await this.prisma.inventoryMovement.create({
      data: {
        productId,
        variantId,
        type: 'SALE',
        quantity: -quantity,
        reason: 'Order placed',
        previousStock: 0, // Will be updated by trigger or ignored
        newStock: 0,
      },
    });
  }

  private async increaseInventory(
    productId: string,
    variantId: string | undefined | null,
    quantity: number,
  ) {
    if (variantId) {
      await this.prisma.productVariant.update({
        where: { id: variantId },
        data: { inventoryQuantity: { increment: quantity } },
      });
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { inventoryQuantity: { increment: quantity } },
    });

    // Create inventory movement record
    await this.prisma.inventoryMovement.create({
      data: {
        productId,
        variantId,
        type: 'RETURN',
        quantity,
        reason: 'Order cancelled',
        previousStock: 0,
        newStock: 0,
      },
    });
  }
}
