import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { BlockKind } from '@prisma/client';

export class BlockFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;
}

export class CreateBlockDto {
  @IsEnum(BlockKind)
  kind!: BlockKind;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class UpdateBlockDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

  /** An empty string clears the actor. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  actor?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  hotspots?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockFieldDto)
  fields?: BlockFieldDto[];
}
