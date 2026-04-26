import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
  Min,
  IsUrl,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '@prisma/client';
import { Type } from 'class-transformer';

class ProductImageDto {
  @ApiPropertyOptional({
    description: 'Existing image ID — include to update, omit to create',
  })
  @IsOptional()
  @IsString({ message: 'Image ID must be a string' })
  id?: string;

  @ApiProperty()
  @IsString({ message: 'Image URL must be a string' })
  @IsUrl({}, { message: 'Image URL must be a valid URL (e.g. https://example.com/image.jpg)' })
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Image alt text must be a string' })
  alt?: string;

  @ApiProperty()
  @IsBoolean({ message: 'isPrimary must be true or false' })
  isPrimary!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: 'Image order must be a number' })
  @Min(0, { message: 'Image order cannot be negative' })
  order?: number;
}

class ProductVariantDto {
  @ApiPropertyOptional({
    description: 'Existing variant ID — include to update, omit to create',
  })
  @IsOptional()
  @IsString({ message: 'Variant ID must be a string' })
  id?: string;

  @ApiProperty()
  @IsString({ message: 'Variant SKU is required' })
  @MinLength(1, { message: 'Variant SKU cannot be empty' })
  @MaxLength(100, { message: 'Variant SKU cannot exceed 100 characters' })
  sku!: string;

  @ApiProperty()
  @IsString({ message: 'Variant name is required' })
  @MinLength(1, { message: 'Variant name cannot be empty' })
  @MaxLength(255, { message: 'Variant name cannot exceed 255 characters' })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 1 name must be a string' })
  option1Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 1 value must be a string' })
  option1Value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 2 name must be a string' })
  option2Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 2 value must be a string' })
  option2Value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 3 name must be a string' })
  option3Name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Option 3 value must be a string' })
  option3Value?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({}, { message: 'Variant price must be a number' })
  @Min(0, { message: 'Variant price cannot be negative' })
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Variant compare price must be a number' })
  @Min(0, { message: 'Variant compare price cannot be negative' })
  comparePrice?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({}, { message: 'Variant inventory quantity must be a number' })
  @Min(0, { message: 'Variant inventory quantity cannot be negative' })
  inventoryQuantity!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Variant weight must be a number' })
  @Min(0, { message: 'Variant weight cannot be negative' })
  weight?: number;

  @ApiProperty()
  @IsString({ message: 'Variant image URL must be a string' })
  @IsUrl({}, { message: 'Variant image URL must be a valid URL (e.g. https://example.com/image.jpg)' })
  image!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Variant isActive must be true or false' })
  isActive?: boolean;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString({ message: 'SKU is required' })
  @MinLength(1, { message: 'SKU cannot be empty' })
  @MaxLength(100, { message: 'SKU cannot exceed 100 characters' })
  sku!: string;

  @ApiProperty()
  @IsString({ message: 'Product name is required' })
  @MinLength(1, { message: 'Product name cannot be empty' })
  @MaxLength(255, { message: 'Product name cannot exceed 255 characters' })
  name!: string;

  @ApiProperty()
  @IsString({ message: 'Slug is required' })
  @MinLength(1, { message: 'Slug cannot be empty' })
  @MaxLength(255, { message: 'Slug cannot exceed 255 characters' })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
  description?: string;

  @ApiProperty({ enum: ProductType, default: 'PHYSICAL' })
  @IsEnum(ProductType, { message: 'Product type must be PHYSICAL or DIGITAL' })
  type: ProductType = ProductType.PHYSICAL;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({}, { message: 'Price must be a number' })
  @Min(0, { message: 'Price cannot be negative' })
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Compare price must be a number' })
  @Min(0, { message: 'Compare price cannot be negative' })
  comparePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Cost price must be a number' })
  @Min(0, { message: 'Cost price cannot be negative' })
  costPrice?: number;

  @ApiProperty({ default: 0 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Inventory quantity must be a number' })
  @Min(0, { message: 'Inventory quantity cannot be negative' })
  inventoryQuantity!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Inventory tracked must be true or false' })
  inventoryTracked?: boolean;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Low stock threshold must be a number' })
  @Min(0, { message: 'Low stock threshold cannot be negative' })
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight cannot be negative' })
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Length must be a number' })
  @Min(0, { message: 'Length cannot be negative' })
  length?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Width must be a number' })
  @Min(0, { message: 'Width cannot be negative' })
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Height must be a number' })
  @Min(0, { message: 'Height cannot be negative' })
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({}, { message: 'Download URL must be a valid URL (e.g. https://example.com/file.zip)' })
  downloadUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Download limit must be a number' })
  @Min(1, { message: 'Download limit must be at least 1' })
  downloadLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Download expiry must be a number' })
  @Min(1, { message: 'Download expiry must be at least 1 day' })
  downloadExpiry?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Owner name must be a string' })
  @MaxLength(255, { message: 'Owner name cannot exceed 255 characters' })
  ownerName?: string;

  @ApiProperty()
  @IsString({ message: 'Owner WhatsApp number is required' })
  @MaxLength(50, { message: 'Owner WhatsApp number cannot exceed 50 characters' })
  ownerWhatsapp!: string;

  @ApiProperty()
  @IsString({ message: 'Category is required' })
  categoryId!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false' })
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'isFeatured must be true or false' })
  isFeatured?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'isBestSeller must be true or false' })
  isBestSeller?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Meta title must be a string' })
  @MaxLength(255, { message: 'Meta title cannot exceed 255 characters' })
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ message: 'Meta description must be a string' })
  @MaxLength(500, { message: 'Meta description cannot exceed 500 characters' })
  metaDescription?: string;

  @ApiProperty({ type: [ProductImageDto] })
  @IsArray({ message: 'Images must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ProductImageDto)
  images!: ProductImageDto[];

  @ApiPropertyOptional({ type: [ProductVariantDto] })
  @IsOptional()
  @IsArray({ message: 'Variants must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}
