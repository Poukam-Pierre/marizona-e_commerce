/**
 * E-Commerce API - Main Entry Point
 * NestJS Production-Ready REST API
 */

import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3002;
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Global prefix with versioning
  app.setGlobalPrefix('api/v1');
  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false, // Disabled to prevent Boolean("false") -> true
      },
    }),
  );

  // Swagger/OpenAPI
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('ShopNx E-Commerce API')
      .setDescription('Production-ready E-Commerce REST API with NestJS')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints (Admin only)')
      .addTag('users', 'User management (Admin only)')
      .addTag('products', 'Product management')
      .addTag('categories', 'Category management')
      .addTag('orders', 'Order management')
      .addTag('inventory', 'Inventory management')
      .addTag('notifications', 'Notification services')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    Logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`);
  }

  // Start server
  await app.listen(port);

  Logger.log(`🚀 API running on: http://localhost:${port}/api/v1`);
  Logger.log(`🌍 Environment: ${nodeEnv}`);
}

bootstrap();
