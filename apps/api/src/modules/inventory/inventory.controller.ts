import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, QueryInventoryDto } from './dto/adjust-inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AdminJwtPayload } from '../../common/decorators/current-user.decorator';
import { AdminRole } from '@prisma/client';

@ApiBearerAuth()
@ApiTags('inventory')
@Controller('inventory')
@Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('adjust')
  @ApiOperation({ summary: 'Adjust inventory (admin)' })
  @ApiResponse({ status: 200, description: 'Inventory adjusted' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Insufficient stock' })
  adjust(@Body() dto: AdjustInventoryDto, @CurrentUser() user?: AdminJwtPayload) {
    return this.inventoryService.adjust(dto, user?.sub);
  }

  @Get('history/:productId')
  @ApiOperation({ summary: 'Get inventory history for product (admin)' })
  @ApiParam({ name: 'productId', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Inventory history' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  getHistory(@Param('productId') productId: string, @Query() query: QueryInventoryDto) {
    return this.inventoryService.getHistory(productId, query);
  }
}
