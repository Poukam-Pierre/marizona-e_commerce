import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  CreateSettingDto,
  UpdateSettingDto,
  BulkUpdateSettingDto,
} from './dto/update-setting.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRole } from '@prisma/client';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @ApiBearerAuth()
  @Get()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Get all settings grouped by category (admin)' })
  @ApiResponse({ status: 200, description: 'Settings grouped by category' })
  findAll() {
    return this.settingsService.findAll();
  }

  @ApiBearerAuth()
  @Get('category/:category')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Get settings by category (admin)' })
  @ApiParam({ name: 'category', description: 'Setting category' })
  @ApiResponse({ status: 200, description: 'Settings for the category' })
  findByCategory(@Param('category') category: string) {
    return this.settingsService.findByCategory(category);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get public settings (storefront)' })
  @ApiResponse({ status: 200, description: 'Public settings for storefront' })
  async getPublicSettings() {
    // Return only settings that are safe for public access
    const allSettings = await this.settingsService.findAll();
    const publicSettings: Record<string, any> = {};

    // Define which keys are public
    const publicKeys = [
      'storeName',
      'storeDescription',
      'storeLogo',
      'storeEmail',
      'storePhone',
      'currency',
      'currencySymbol',
      'taxRate',
      'shippingCost',
      'freeShippingThreshold',
      'socialFacebook',
      'socialInstagram',
      'socialTwitter',
      'socialYoutube',
      'seoTitle',
      'seoDescription',
      'seoKeywords',
    ];

    for (const category of Object.keys(allSettings)) {
      for (const key of Object.keys(allSettings[category])) {
        if (publicKeys.includes(key)) {
          if (!publicSettings[category]) {
            publicSettings[category] = {};
          }
          publicSettings[category][key] = allSettings[category][key];
        }
      }
    }

    return publicSettings;
  }

  @ApiBearerAuth()
  @Get(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER)
  @ApiOperation({ summary: 'Get setting by key (admin)' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  @ApiResponse({ status: 200, description: 'Setting details' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @ApiBearerAuth()
  @Post()
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Create or update a setting (admin)' })
  @ApiResponse({ status: 201, description: 'Setting created/updated' })
  upsert(@Body() dto: CreateSettingDto) {
    return this.settingsService.upsert(dto);
  }

  @ApiBearerAuth()
  @Post('bulk')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Bulk create/update settings (admin)' })
  @ApiResponse({ status: 201, description: 'Settings created/updated' })
  bulkUpsert(@Body() dto: BulkUpdateSettingDto) {
    return this.settingsService.bulkUpsert(dto);
  }

  @ApiBearerAuth()
  @Put(':key')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Update a setting (admin)' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  @ApiResponse({ status: 200, description: 'Setting updated' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.update(key, dto);
  }

  @ApiBearerAuth()
  @Delete(':key')
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a setting (super admin only)' })
  @ApiParam({ name: 'key', description: 'Setting key' })
  @ApiResponse({ status: 200, description: 'Setting deleted' })
  @ApiResponse({ status: 404, description: 'Setting not found' })
  remove(@Param('key') key: string) {
    return this.settingsService.remove(key);
  }
}
