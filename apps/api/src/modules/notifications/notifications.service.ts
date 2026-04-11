import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CurrencyService } from '../../common/services/currency.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
  ) {}

  async generateWhatsAppCheckoutLink(
    orderId: string,
  ): Promise<{ url: string; message: string }> {
    // Get order details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                ownerName: true,
                ownerWhatsapp: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Get WhatsApp number - prefer product owner's WhatsApp for direct contact
    const firstProduct = order.items[0]?.product;
    const phoneNumber =
      firstProduct?.ownerWhatsapp ||
      order.customerWhatsapp ||
      order.customerPhone;

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
      .map((item) => {
        return `- ${item.productName} x${item.quantity} = ${fmt(item.totalPrice)}`;
      })
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
${order.shippingCity}, ${order.shippingProvince}
${order.shippingPostalCode}
${order.shippingCountry}

${order.customerNotes ? `📝 *Notes:* ${order.customerNotes}` : ''}

Please confirm my order. Thank you! 🙏`;

    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    // Mark as WhatsApp sent
    await this.prisma.order.update({
      where: { id: orderId },
      data: { whatsappSentAt: new Date() },
    });

    this.logger.log(`WhatsApp link generated for order: ${order.orderNumber}`);

    return { url, message };
  }

  async generateOrderConfirmationMessage(
    orderId: string,
  ): Promise<{ message: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const items = order.items
      .map((item) => `- ${item.productName} x${item.quantity}`)
      .join('\n');

    const { code } = await this.currencyService.getConfig();
    const message = `✅ *Order Confirmed!*

📄 *Order ID:* ${order.orderNumber}

📦 *Items:*
${items}

💰 *Total:* ${this.currencyService.format(order.total, code)}

Thank you for your purchase! 🙏`;

    return { message };
  }

  async generateShippingNotification(
    orderId: string,
  ): Promise<{ message: string }> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          select: { productName: true, quantity: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (!order.trackingNumber) {
      throw new BadRequestException('Order does not have tracking number yet');
    }

    const message = `🚚 *Order Shipped!*

📄 *Order ID:* ${order.orderNumber}
📦 *Carrier:* ${order.shippingProvider || 'N/A'}
🔖 *Tracking Number:* ${order.trackingNumber}

Track your shipment for the latest status.

Thank you! 🙏`;

    return { message };
  }


}
