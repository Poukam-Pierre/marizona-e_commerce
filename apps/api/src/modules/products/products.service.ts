import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationService } from '../notifications/push-notification.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

const CACHE_KEY_PREFIX = 'products';
const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationService: PushNotificationService,
  ) {}

  async findAll(query: QueryProductDto): Promise<PaginatedResult<any>> {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      categoryId,
      isActive,
      isFeatured,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    // Build cache key
    const cacheKey = `${CACHE_KEY_PREFIX}:list:${JSON.stringify(query)}`;

    // Try to get from cache
    const cached = await this.redisService.get<PaginatedResult<any>>(cacheKey);
    if (cached) {
      return cached;
    }

    // Build where clause
    const where: any = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { description: { contains: search } },
      ];
    }

    if (type) {
      where.type = type;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // Build order by
    const orderBy: any = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    // Execute queries
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          images: {
            orderBy: { order: 'asc' },
          },
          variants: {
            where: { isActive: true },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResult<any> = {
      data: products,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };

    // Cache the result
    await this.redisService.set(cacheKey, result, CACHE_TTL);

    return result;
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            sku: true,
            name: true,
            price: true,
            comparePrice: true,
            inventoryQuantity: true,
            isActive: true,
            weight: true,
            option1Name: true,
            option1Value: true,
            option2Name: true,
            option2Value: true,
            option3Name: true,
            option3Value: true,
            image: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug, deletedAt: null },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { order: 'asc' },
        },
        variants: {
          where: { isActive: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with slug ${slug} not found`);
    }

    return product;
  }

  async create(payload: CreateProductDto) {
    const {
      sku,
      categoryId,
      description,
      images,
      inventoryQuantity,
      name,
      ownerWhatsapp,
      price,
      slug,
      type,
      comparePrice,
      costPrice,
      downloadExpiry,
      downloadLimit,
      downloadUrl,
      height,
      inventoryTracked,
      isActive,
      isBestSeller,
      isFeatured,
      length,
      lowStockThreshold,
      metaDescription,
      metaTitle,
      ownerName,
      variants,
      weight,
      width,
    } = payload;

    // Check if SKU exists
    const existingSku = await this.prisma.product.findUnique({
      where: { sku },
    });

    if (existingSku && !existingSku.deletedAt) {
      throw new ConflictException(`Product with SKU ${sku} already exists`);
    }

    // Check if slug exists
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug },
    });

    if (existingSlug && !existingSlug.deletedAt) {
      throw new ConflictException(`Product with slug ${slug} already exists`);
    }

    const urlPrimaryImage = images.find((img) => img.isPrimary)?.url;

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sku,
        name,
        slug,
        description,
        type,
        price,
        comparePrice,
        costPrice,
        inventoryQuantity,
        inventoryTracked,
        lowStockThreshold,
        weight,
        length,
        width,
        height,
        downloadUrl,
        downloadLimit,
        downloadExpiry,
        ownerName,
        ownerWhatsapp,
        categoryId,
        image: urlPrimaryImage,
        isActive,
        isFeatured,
        isBestSeller,
        metaTitle,
        metaDescription,
        // Create images if provided
        images: images.length
          ? {
              create: images.map((img, index) => ({
                url: img.url,
                alt: img.alt || name,
                order: img.order ?? index,
                isPrimary: img.isPrimary ?? index === 0,
              })),
            }
          : undefined,
        // Create variants if provided
        variants: variants?.length
          ? {
              create: variants.map((variant) => ({
                ...variant,
              })),
            }
          : undefined,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: true,
        variants: true,
      },
    });

    // Clear cache
    await this.clearCache();

    this.logger.log(`Product created: ${product.sku}`);

    // Emit real-time notification for new product
    this.notificationsGateway.emitProductCreated({
      type: 'product.created',
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        image: product.image || undefined,
        categoryId: product.categoryId || undefined,
        categoryName: product.category?.name,
      },
      timestamp: new Date(),
    });

    // Send push notification to all subscribed users (background/PWA)
    try {
      await this.pushNotificationService.notifyProductCreated(product);
    } catch (error) {
      // Log error but don't fail the product creation
      this.logger.error(
        `Failed to send push notification for product ${product.sku}:`,
        error,
      );
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    // Check if product exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Check SKU uniqueness if changing
    if (dto.sku && dto.sku !== existingProduct.sku) {
      const existingSku = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });

      if (existingSku && !existingSku.deletedAt) {
        throw new ConflictException(
          `Product with SKU ${dto.sku} already exists`,
        );
      }
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existingProduct.slug) {
      const existingSlug = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });

      if (existingSlug && !existingSlug.deletedAt) {
        throw new ConflictException(
          `Product with slug ${dto.slug} already exists`,
        );
      }
    }
    // Destructure to separate unproper type fields for update logic
    const { categoryId, images, variants, ...rest } = dto;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(images
          ? {
              image:
                images.find((img) => img.isPrimary)?.url ||
                existingProduct.image,
              images: {
                deleteMany: {},
                create: images.map((img, index) => ({
                  url: img.url,
                  alt: img.alt || existingProduct.name,
                  order: img.order ?? index,
                  isPrimary: img.isPrimary ?? index === 0,
                })),
              },
            }
          : {}),
        ...(variants ? { variants: { deleteMany: {}, create: variants } } : {}),
        ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
        updatedAt: new Date(),
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Clear cache
    await this.clearCache();

    this.logger.log(`Product updated: ${product.sku}`);

    // // Emit real-time notification for product update
    // this.notificationsGateway.emitProductUpdated({
    //   type: 'product.updated',
    //   product: {
    //     id: product.id,
    //     name: product.name,
    //     slug: product.slug,
    //     price: product.price,
    //     image: product.image,
    //     categoryId: product.categoryId,
    //     categoryName: product.category?.name,
    //   },
    //   timestamp: new Date(),
    // });

    return product;
  }

  async remove(id: string) {
    // Check if product exists
    const existingProduct = await this.prisma.product.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingProduct) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Clear cache
    await this.clearCache();

    this.logger.log(`Product deleted: ${existingProduct.sku}`);

    // // Emit real-time notification for product deletion
    // this.notificationsGateway.emitProductDeleted({
    //   type: 'product.deleted',
    //   product: {
    //     id: existingProduct.id,
    //     name: existingProduct.name,
    //     slug: existingProduct.slug,
    //     price: existingProduct.price,
    //     image: existingProduct.image,
    //     categoryId: existingProduct.categoryId,
    //   },
    //   timestamp: new Date(),
    // });

    return { message: 'Product deleted successfully' };
  }

  private async clearCache() {
    await this.redisService.delPattern(`${CACHE_KEY_PREFIX}:*`);
  }
}
