import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import { PaginationDto, PaginatedResult } from '../../common/dto/pagination.dto';
import { AdminRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationDto): Promise<PaginatedResult<any>> {
    const { page, limit, skip } = pagination;

    const [users, total] = await Promise.all([
      this.prisma.adminUser.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.adminUser.count({
        where: { deletedAt: null },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async create(dto: CreateUserDto) {
    // Check if email already exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { email: dto.email },
    });

    if (existingUser && !existingUser.deletedAt) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.adminUser.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: dto.role || AdminRole.ADMIN,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    // Check if user exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Check email uniqueness if changing email
    if (dto.email && dto.email !== existingUser.email) {
      const emailExists = await this.prisma.adminUser.findUnique({
        where: { email: dto.email },
      });

      if (emailExists) {
        throw new ConflictException('Email already registered');
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.email) updateData.email = dto.email;
    if (dto.role) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password) {
      updateData.password = await bcrypt.hash(dto.password, 10);
      updateData.passwordChangedAt = new Date();
    }

    // Update user
    const user = await this.prisma.adminUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        isActive: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User updated: ${user.email}`);
    return user;
  }

  async remove(id: string) {
    // Check if user exists
    const existingUser = await this.prisma.adminUser.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existingUser) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft delete
    await this.prisma.adminUser.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`User deleted: ${existingUser.email}`);
    return { message: 'User deleted successfully' };
  }
}
