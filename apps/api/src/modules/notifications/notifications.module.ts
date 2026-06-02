import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushNotificationService } from './push-notification.service';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushNotificationService,
  ],
  exports: [
    NotificationsService,
    PushNotificationService,
  ],
})
export class NotificationsModule {}
