import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import {
  CreatePushSubscriptionDto,
  DeletePushSubscriptionDto,
} from './dto/push-subscription.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushService: PushNotificationService,
  ) {}

  @Public()
  @Get('whatsapp/:orderId')
  @ApiOperation({ summary: 'Generate WhatsApp checkout link (public)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'WhatsApp URL and message' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  generateWhatsAppLink(@Param('orderId') orderId: string) {
    return this.notificationsService.generateWhatsAppCheckoutLink(orderId);
  }

  @ApiBearerAuth()
  @Get('confirmation/:orderId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Generate order confirmation message (admin)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Confirmation message' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  generateConfirmation(@Param('orderId') orderId: string) {
    return this.notificationsService.generateOrderConfirmationMessage(orderId);
  }

  @ApiBearerAuth()
  @Get('shipping/:orderId')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Generate shipping notification (admin)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Shipping notification message' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 400, description: 'No tracking number' })
  generateShippingNotification(@Param('orderId') orderId: string) {
    return this.notificationsService.generateShippingNotification(orderId);
  }

  // Push Notification Endpoints

  @Public()
  @Get('push/vapid-key')
  @ApiOperation({
    summary: 'Get public VAPID key for push subscriptions (public)',
  })
  @ApiResponse({ status: 200, description: 'VAPID public key' })
  getVapidKey() {
    return { publicKey: this.pushService.getPublicVapidKey() };
  }

  @Public()
  @Post('push/subscribe')
  @ApiOperation({ summary: 'Subscribe to push notifications (public)' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  @ApiResponse({ status: 400, description: 'Invalid subscription data' })
  subscribeToPush(@Body() dto: CreatePushSubscriptionDto) {
    return this.pushService.subscribe(dto);
  }

  @Public()
  @Delete('push/unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications (public)' })
  @ApiResponse({ status: 200, description: 'Successfully unsubscribed' })
  unsubscribeFromPush(@Body() dto: DeletePushSubscriptionDto) {
    return this.pushService.unsubscribe(dto);
  }
}
