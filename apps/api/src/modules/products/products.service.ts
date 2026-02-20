import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
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

  async create(dto: CreateProductDto) {
    // Check if SKU exists
    const existingSku = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });

    if (existingSku && !existingSku.deletedAt) {
      throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
    }

    // Check if slug exists
    const existingSlug = await this.prisma.product.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug && !existingSlug.deletedAt) {
      throw new ConflictException(`Product with slug ${dto.slug} already exists`);
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        type: dto.type || 'PHYSICAL',
        price: dto.price,
        comparePrice: dto.comparePrice,
        costPrice: dto.costPrice,
        inventoryQuantity: dto.inventoryQuantity || 0,
        inventoryTracked: dto.inventoryTracked ?? true,
        lowStockThreshold: dto.lowStockThreshold || 10,
        weight: dto.weight,
        length: dto.length,
        width: dto.width,
        height: dto.height,
        downloadUrl: dto.downloadUrl,
        downloadLimit: dto.downloadLimit,
        downloadExpiry: dto.downloadExpiry,
        ownerName: dto.ownerName,
        ownerWhatsapp: dto.ownerWhatsapp,
        categoryId: dto.categoryId,
        image: dto.image,
        isActive: dto.isActive ?? true,
        isFeatured: dto.isFeatured ?? false,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    // Clear cache
    await this.clearCache();

    this.logger.log(`Product created: ${product.sku}`);
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
        throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
      }
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existingProduct.slug) {
      const existingSlug = await this.prisma.product.findUnique({
        where: { slug: dto.slug },
      });

      if (existingSlug && !existingSlug.deletedAt) {
        throw new ConflictException(`Product with slug ${dto.slug} already exists`);
      }
    }

    // Update product
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
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
    return { message: 'Product deleted successfully' };
  }

  private async clearCache() {
    await this.redisService.delPattern(`${CACHE_KEY_PREFIX}:*`);
  }
}
