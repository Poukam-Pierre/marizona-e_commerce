import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AdjustInventoryDto, QueryInventoryDto } from './dto/adjust-inventory.dto';
import { MovementType } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private prisma: PrismaService) {}

  async adjust(dto: AdjustInventoryDto, userId?: string) {
    // Get product
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    }

    // Get previous stock
    let previousStock = product.inventoryQuantity;

    if (dto.variantId) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: dto.variantId, productId: dto.productId, isActive: true },
      });

      if (!variant) {
        throw new NotFoundException(`Variant with ID ${dto.variantId} not found`);
      }

      previousStock = variant.inventoryQuantity;
    }

    // Calculate quantity change based on movement type
    let quantityChange = dto.quantity;
    if (dto.type === MovementType.SALE || dto.type === MovementType.DAMAGE) {
      quantityChange = -Math.abs(dto.quantity);
    } else if (dto.type === MovementType.RETURN || dto.type === MovementType.PURCHASE) {
      quantityChange = Math.abs(dto.quantity);
    }
    // ADJUSTMENT and TRANSFER keep the original sign

    // Calculate new stock
    const newStock = previousStock + quantityChange;

    // Validate stock doesn't go negative
    if (newStock < 0) {
      throw new BadRequestException('Insufficient stock for this adjustment');
    }

    // Use transaction to update stock and create movement record
    const result = await this.prisma.$transaction(async (tx) => {
      // Update product stock
      if (dto.variantId) {
        await tx.productVariant.update({
          where: { id: dto.variantId },
          data: { inventoryQuantity: newStock },
        });
      }

      // Always update product stock
      await tx.product.update({
        where: { id: dto.productId },
        data: { inventoryQuantity: product.inventoryQuantity + quantityChange },
      });

      // Create inventory movement record
      const movement = await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          variantId: dto.variantId,
          type: dto.type,
          quantity: quantityChange,
          reason: dto.reason,
          reference: dto.reference,
          previousStock,
          newStock,
          notes: dto.notes,
          userId,
        },
      });

      return movement;
    });

    this.logger.log(
      `Inventory adjusted for product ${product.sku}: ${previousStock} -> ${newStock} (${dto.type})`,
    );

    return {
      message: 'Inventory adjusted successfully',
      previousStock,
      newStock,
      movement: result,
    };
  }

  async getHistory(productId: string, query?: QueryInventoryDto) {
    // Verify product exists
    const product = await this.prisma.product.findUnique({
      where: { id: productId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const movements = await this.prisma.inventoryMovement.findMany({
      where: {
        productId,
        variantId: query?.variantId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      product: {
        id: product.id,
        sku: product.sku,
        name: product.name,
        currentStock: product.inventoryQuantity,
      },
      movements,
    };
  }
}
