import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      productCount: cat._count.products,
    }));
  }

  async findTree() {
    const categories = await this.prisma.category.findMany({
      where: { deletedAt: null, parentId: null },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { deletedAt: null },
          orderBy: [{ order: 'asc' }, { name: 'asc' }],
          include: {
            children: {
              where: { deletedAt: null },
              orderBy: [{ order: 'asc' }, { name: 'asc' }],
            },
            _count: {
              select: { products: { where: { deletedAt: null } } },
            },
          },
        },
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    return categories.map((cat) => ({
      ...cat,
      productCount: cat._count.products,
      children: cat.children.map((child) => ({
        ...child,
        productCount: child._count.products,
      })),
    }));
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id, deletedAt: null },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: { where: { deletedAt: null } } },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return {
      ...category,
      productCount: category._count.products,
    };
  }

  async create(dto: CreateCategoryDto) {
    // Check if slug exists
    const existingSlug = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug && !existingSlug.deletedAt) {
      throw new ConflictException(
        `Category with slug ${dto.slug} already exists`,
      );
    }

    // Check if parent exists
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId, deletedAt: null },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${dto.parentId} not found`,
        );
      }
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        image: dto.image,
        ...(dto.parentId && { parentId: dto.parentId }),
        order: dto.order || 0,
        isActive: dto.isActive ?? true,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    this.logger.log(`Category created: ${category.slug}`);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    // Check if category exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existingCategory.slug) {
      const existingSlug = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });

      if (existingSlug && !existingSlug.deletedAt) {
        throw new ConflictException(
          `Category with slug ${dto.slug} already exists`,
        );
      }
    }

    // Check if parent exists and not setting parent to itself
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('Cannot set category as its own parent');
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId, deletedAt: null },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${dto.parentId} not found`,
        );
      }

      // Check for circular reference
      const isCircular = await this.checkCircularReference(id, dto.parentId);
      if (isCircular) {
        throw new BadRequestException(
          'Circular reference detected in category hierarchy',
        );
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
      include: {
        parent: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    this.logger.log(`Category updated: ${category.slug}`);
    return category;
  }

  async remove(id: string) {
    // Check if category exists
    const existingCategory = await this.prisma.category.findUnique({
      where: { id, deletedAt: null },
      include: {
        children: { where: { deletedAt: null } },
        products: { where: { deletedAt: null } },
      },
    });

    if (!existingCategory) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // Check if category has children
    if (existingCategory.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with children. Remove children first.',
      );
    }

    // Soft delete
    await this.prisma.category.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Category deleted: ${existingCategory.slug}`);
    return { message: 'Category deleted successfully' };
  }

  private async checkCircularReference(
    categoryId: string,
    newParentId: string,
  ): Promise<boolean> {
    let currentParentId: string | null = newParentId;

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true;
      }

      const parent = await this.prisma.category.findUnique({
        where: { id: currentParentId, deletedAt: null },
        select: { parentId: true },
      });

      currentParentId = parent?.parentId;
    }

    return false;
  }
}
