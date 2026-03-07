import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import * as webpush from 'web-push';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from './dto/push-subscription.dto';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: {
    url?: string;
    productId?: string;
    productSlug?: string;
    [key: string]: unknown;
  };
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(private prisma: PrismaService) {
    // Configure VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT;

    if (vapidPublicKey && vapidPrivateKey && vapidSubject) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.logger.log('VAPID keys configured successfully');
    } else {
      this.logger.warn(
        'VAPID keys not configured. Push notifications will not work.',
      );
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(dto: CreatePushSubscriptionDto) {
    try {
      // Check if subscription already exists
      const existing = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: dto.endpoint },
      });

      if (existing) {
        // Update if exists
        return await this.prisma.pushSubscription.update({
          where: { endpoint: dto.endpoint },
          data: {
            p256dh: dto.p256dh,
            auth: dto.auth,
            userAgent: dto.userAgent,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      }

      // Create new subscription
      const subscription = await this.prisma.pushSubscription.create({
        data: {
          endpoint: dto.endpoint,
          p256dh: dto.p256dh,
          auth: dto.auth,
          userAgent: dto.userAgent,
        },
      });

      this.logger.log(`New push subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      this.logger.error('Failed to create subscription:', error);
      throw new BadRequestException(
        'Failed to subscribe to push notifications',
      );
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(dto: DeletePushSubscriptionDto) {
    try {
      const subscription = await this.prisma.pushSubscription.findUnique({
        where: { endpoint: dto.endpoint },
      });

      if (!subscription) {
        return { message: 'Subscription not found' };
      }

      await this.prisma.pushSubscription.update({
        where: { endpoint: dto.endpoint },
        data: { isActive: false },
      });

      this.logger.log(`Push subscription deactivated: ${subscription.id}`);
      return { message: 'Successfully unsubscribed' };
    } catch (error) {
      this.logger.error('Failed to unsubscribe:', error);
      throw new BadRequestException('Failed to unsubscribe');
    }
  }

  /**
   * Send push notification to a single subscription
   */
  async sendToSubscription(
    subscription: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload,
  ): Promise<boolean> {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, JSON.stringify(payload));

      return true;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; body?: string };
      this.logger.error(
        `Failed to send push notification: ${err.statusCode} - ${err.body}`,
      );

      // If subscription is invalid (410 Gone), deactivate it
      if (err.statusCode === 410) {
        await this.prisma.pushSubscription.update({
          where: { endpoint: subscription.endpoint },
          data: { isActive: false },
        });
        this.logger.log(
          `Deactivated invalid subscription: ${subscription.endpoint}`,
        );
      }

      return false;
    }
  }

  /**
   * Send push notification to all active subscriptions
   */
  async sendToAll(payload: PushPayload): Promise<{
    sent: number;
    failed: number;
  }> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { isActive: true },
    });

    if (subscriptions.length === 0) {
      this.logger.log('No active push subscriptions found');
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    // Send notifications in parallel (batches of 100)
    const batchSize = 100;
    for (let i = 0; i < subscriptions.length; i += batchSize) {
      const batch = subscriptions.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((sub) => this.sendToSubscription(sub, payload)),
      );

      sent += results.filter((r) => r === true).length;
      failed += results.filter((r) => r === false).length;
    }

    this.logger.log(
      `Push notifications sent: ${sent} successful, ${failed} failed`,
    );

    return { sent, failed };
  }

  /**
   * Send notification about new product creation
   */
  async notifyProductCreated(product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    image?: string | null;
  }): Promise<void> {
    const payload: PushPayload = {
      title: 'New Product Available! 🎉',
      body: `${product.name} - ${this.formatPrice(product.price)}`,
      icon: product.image || '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: {
        url: `/products/${product.slug}`,
        productId: product.id,
        productSlug: product.slug,
        type: 'product.created',
      },
    };

    await this.sendToAll(payload);
  }

  /**
   * Get public VAPID key for client subscriptions
   */
  getPublicVapidKey(): string {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) {
      throw new BadRequestException('VAPID keys not configured on server');
    }
    return publicKey;
  }

  /**
   * Format price for display
   */
  private formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XAF',
    }).format(price);
  }
}
