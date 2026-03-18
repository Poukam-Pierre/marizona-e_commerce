import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsNumber,
  ValidateNested,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class OrderItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  // Customer info
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  customerName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  customerPhone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerWhatsapp?: string;

  // Shipping info
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  shippingName!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  shippingPhone!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  shippingAddress!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shippingCity!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  shippingProvince!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shippingPostalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shippingCountry?: string;

  // Items
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  // Optional
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string;
}
