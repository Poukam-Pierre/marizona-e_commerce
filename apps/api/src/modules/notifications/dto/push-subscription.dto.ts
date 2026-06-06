import { IsString, IsOptional, IsDefined } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePushSubscriptionDto {
  @ApiProperty({
    description: 'Push endpoint URL',
    example: 'https://fcm.googleapis.com/fcm/send/...',
  })
  @IsString()
  @IsDefined()
  endpoint!: string;

  @ApiProperty({
    description: 'P256DH public key for encryption',
    example: 'BN...',
  })
  @IsString()
  @IsDefined()
  p256dh!: string;

  @ApiProperty({
    description: 'Auth secret for encryption',
    example: 'abc123...',
  })
  @IsString()
  @IsDefined()
  auth!: string;

  @ApiPropertyOptional({
    description: 'User agent string',
  })
  @IsString()
  @IsOptional()
  userAgent?: string;
}

export class DeletePushSubscriptionDto {
  @ApiProperty({
    description: 'Push endpoint URL to delete',
  })
  @IsString()
  @IsDefined()
  endpoint!: string;
}
