import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminRole } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @ApiBearerAuth()
  @Get()
  @Roles(
    AdminRole.SUPER_ADMIN,
    AdminRole.ADMIN,
    AdminRole.MANAGER,
    AdminRole.VIEWER,
  )
  @ApiOperation({ summary: 'Get all orders (admin)' })
  @ApiResponse({ status: 200, description: 'List of orders' })
  findAll(@Query() query: QueryOrderDto) {
    return this.ordersService.findAll(query);
  }

  @Public()
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @Get(':id')
  @ApiOperation({
    summary: 'Get public order view by ID + lookup token (public)',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiQuery({
    name: 'token',
    description: 'Lookup token issued at checkout',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'Public order details' })
  @ApiResponse({ status: 404, description: 'Order not found or token invalid' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  findOne(@Param('id') id: string, @Query('token') token: string) {
    return this.ordersService.findOnePublic(id, token ?? '');
  }

  @Public()
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @Get(':id/items/:itemId/download')
  @ApiOperation({ summary: 'Proxy download for a digital order item (public)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiParam({ name: 'itemId', description: 'Order item ID' })
  @ApiQuery({ name: 'token', description: 'Lookup token', required: true })
  @ApiResponse({ status: 302, description: 'Redirect to download URL' })
  @ApiResponse({
    status: 403,
    description: 'Not eligible (reason in response body)',
  })
  @ApiResponse({ status: 404, description: 'Order or item not found' })
  async downloadItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const { downloadUrl } = await this.ordersService.processDownload(
      id,
      itemId,
      token ?? '',
    );
    // Use @Res() directly — @Redirect() conflicts with TransformInterceptor
    // which wraps the return value before NestJS can read the url property,
    // resulting in an empty Location header.
    res.redirect(HttpStatus.FOUND, downloadUrl);
  }

  @Public()
  @Get(':id/whatsapp')
  @ApiOperation({ summary: 'Generate WhatsApp checkout link (public)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'WhatsApp URL' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  generateWhatsAppLink(@Param('id') id: string) {
    return this.ordersService.generateWhatsAppLink(id);
  }

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a new order (public)' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({
    status: 400,
    description: 'Invalid products or insufficient stock',
  })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Update order (admin)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order updated' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @ApiBearerAuth()
  @Delete(':id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Cancel order (admin)' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({
    status: 400,
    description: 'Only pending orders can be cancelled',
  })
  remove(@Param('id') id: string) {
    return this.ordersService.remove(id);
  }
}
