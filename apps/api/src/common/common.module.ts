import { Global, Module } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';
import { CurrencyService } from './services/currency.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, CurrencyService],
  exports: [PrismaService, RedisService, CurrencyService],
})
export class CommonModule {}
