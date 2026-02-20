import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: QueryOrderDto): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 10, status, paymentStatus, customerId, search, startDate, endDate } = query;
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
          select: { id: true, name: true, email: true, phone: true, whatsappNumber: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, image: true, type: true },
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
      throw new BadRequestException('One or more products not found or inactive');
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
          ? product.variants?.find((v) => v.id === item.variantId)?.inventoryQuantity || 0
          : product.inventoryQuantity;

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${availableStock}`,
          );
        }
      }
    }

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

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
        total: subtotal, // Will be updated with shipping, tax, etc.
        couponCode: dto.couponCode,
        customerNotes: dto.customerNotes,
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
        await this.decreaseInventory(item.productId, item.variantId, item.quantity);
      }
    }

    this.logger.log(`Order created: ${order.orderNumber}`);
    return order;
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
      updateData.status = dto.status;

      // Update timestamps based on status
      if (dto.status === OrderStatus.CONFIRMED && !existingOrder.confirmedAt) {
        updateData.confirmedAt = new Date();
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
    return order;
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
        await this.increaseInventory(item.productId, item.variantId, item.quantity);
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
      throw new BadRequestException('No WhatsApp number available for this order');
    }

    // Format phone number (remove non-digits)
    const formattedPhone = phoneNumber.replace(/\D/g, '');

    // Build message
    const items = order.items
      .map((item) => `- ${item.productName} x${item.quantity} = Rp ${this.formatPrice(item.totalPrice)}`)
      .join('\n');

    const message = `Halo, saya ingin memesan:
    
Order ID: ${order.orderNumber}

${items}

Total: Rp ${this.formatPrice(order.total)}

Nama: ${order.shippingName}
Alamat: ${order.shippingAddress}, ${order.shippingCity}, ${order.shippingProvince} ${order.shippingPostalCode}

Mohon konfirmasi pesanan saya. Terima kasih!`;

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    return { url };
  }

  private async generateOrderNumber(): Promise<string> {
    const date = new Date();
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

  private async decreaseInventory(productId: string, variantId: string | undefined, quantity: number) {
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

  private async increaseInventory(productId: string, variantId: string | undefined, quantity: number) {
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

  private formatPrice(price: number): string {
    return price.toLocaleString('id-ID');
  }
}
