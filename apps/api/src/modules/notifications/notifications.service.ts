import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async generateWhatsAppCheckoutLink(orderId: string): Promise<{ url: string; message: string }> {
    // Get order details
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, ownerName: true, ownerWhatsapp: true },
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
    const phoneNumber = firstProduct?.ownerWhatsapp || order.customerWhatsapp || order.customerPhone;

    if (!phoneNumber) {
      throw new BadRequestException('No WhatsApp number available for this order');
    }

    // Format phone number (remove non-digits)
    const formattedPhone = phoneNumber.replace(/\D/g, '');

    // Build message
    const items = order.items
      .map((item) => {
        const price = this.formatPrice(item.totalPrice);
        return `- ${item.productName} x${item.quantity} = Rp ${price}`;
      })
      .join('\n');

    const message = `Halo, saya ingin memesan:

📄 *Order ID:* ${order.orderNumber}

📦 *Item Pesanan:*
${items}

💰 *Subtotal:* Rp ${this.formatPrice(order.subtotal)}
🚚 *Ongkir:* Rp ${this.formatPrice(order.shippingCost)}
💸 *Total:* Rp ${this.formatPrice(order.total)}

👤 *Nama:* ${order.shippingName}
📱 *Telepon:* ${order.shippingPhone}
📍 *Alamat:*
${order.shippingAddress}
${order.shippingCity}, ${order.shippingProvince}
${order.shippingPostalCode}
${order.shippingCountry}

${order.customerNotes ? `📝 *Catatan:* ${order.customerNotes}` : ''}

Mohon konfirmasi pesanan saya. Terima kasih! 🙏`;

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

  async generateOrderConfirmationMessage(orderId: string): Promise<{ message: string }> {
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

    const message = `✅ *Pesanan Dikonfirmasi!*

📄 *Order ID:* ${order.orderNumber}

📦 *Item:*
${items}

💰 *Total:* Rp ${this.formatPrice(order.total)}

Terima kasih telah berbelanja! 🙏`;

    return { message };
  }

  async generateShippingNotification(orderId: string): Promise<{ message: string }> {
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

    const message = `🚚 *Pesanan Dikirim!*

📄 *Order ID:* ${order.orderNumber}
📦 *Kurir:* ${order.shippingProvider || 'N/A'}
🔖 *No. Resi:* ${order.trackingNumber}

Lacak pengiriman Anda untuk melihat status terbaru.

Terima kasih! 🙏`;

    return { message };
  }

  private formatPrice(price: number): string {
    return price.toLocaleString('id-ID');
  }
}
