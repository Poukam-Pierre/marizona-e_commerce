import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CreateSettingDto,
  UpdateSettingDto,
  BulkUpdateSettingDto,
} from './dto/update-setting.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    const settings = await this.prisma.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Group settings by category
    const grouped: Record<string, Record<string, any>> = {};
    for (const setting of settings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {};
      }
      try {
        grouped[setting.category][setting.key] = JSON.parse(setting.value);
      } catch {
        grouped[setting.category][setting.key] = setting.value;
      }
    }

    return grouped;
  }

  async findByCategory(category: string) {
    const settings = await this.prisma.setting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    const result: Record<string, any> = {};
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        result[setting.key] = setting.value;
      }
    }

    return result;
  }

  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    try {
      return {
        ...setting,
        value: JSON.parse(setting.value),
      };
    } catch {
      return {
        ...setting,
        value: setting.value,
      };
    }
  }

  async upsert(dto: CreateSettingDto) {
    const valueStr =
      typeof dto.value === 'string' ? dto.value : JSON.stringify(dto.value);

    const setting = await this.prisma.setting.upsert({
      where: { key: dto.key },
      update: {
        value: valueStr,
        category: dto.category || 'general',
      },
      create: {
        key: dto.key,
        value: valueStr,
        category: dto.category || 'general',
      },
    });

    this.logger.log(`Setting updated: ${dto.key}`);
    return setting;
  }

  async bulkUpsert(dto: BulkUpdateSettingDto) {
    const results = [];

    for (const setting of dto.settings) {
      const valueStr =
        typeof setting.value === 'string'
          ? setting.value
          : JSON.stringify(setting.value);

      const result = await this.prisma.setting.upsert({
        where: { key: setting.key },
        update: {
          value: valueStr,
          category: setting.category || 'general',
        },
        create: {
          key: setting.key,
          value: valueStr,
          category: setting.category || 'general',
        },
      });
      results.push(result);
    }

    this.logger.log(`Bulk updated ${results.length} settings`);
    return results;
  }

  async update(key: string, dto: UpdateSettingDto) {
    const existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    const valueStr =
      typeof dto.value === 'string' ? dto.value : JSON.stringify(dto.value);

    const setting = await this.prisma.setting.update({
      where: { key },
      data: { value: valueStr },
    });

    this.logger.log(`Setting updated: ${key}`);
    return setting;
  }

  async remove(key: string) {
    const existing = await this.prisma.setting.findUnique({
      where: { key },
    });

    if (!existing) {
      throw new NotFoundException(`Setting with key "${key}" not found`);
    }

    await this.prisma.setting.delete({
      where: { key },
    });

    this.logger.log(`Setting deleted: ${key}`);
    return { message: 'Setting deleted successfully' };
  }

  // Helper method to get a specific setting value
  async getValue<T = any>(key: string, defaultValue?: T): Promise<T> {
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key },
      });

      if (!setting) {
        return defaultValue as T;
      }

      return JSON.parse(setting.value) as T;
    } catch {
      return defaultValue as T;
    }
  }
}
