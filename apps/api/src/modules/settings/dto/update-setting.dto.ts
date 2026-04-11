import {
  IsString,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSettingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  key!: string;

  @ApiProperty({
    description: 'Setting value (can be string, number, boolean, or object)',
  })
  @IsNotEmpty()
  value!: string | number | boolean | Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}

export class UpdateSettingDto {
  @ApiProperty({
    description: 'Setting value (can be string, number, boolean, or object)',
  })
  @IsNotEmpty()
  value!: string | number | boolean | Record<string, unknown>;
}

export class BulkUpdateSettingDto {
  @ApiProperty({ type: [CreateSettingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSettingDto)
  settings!: CreateSettingDto[];
}
