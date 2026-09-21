import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateProcessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  /** The project to list it under; null or omitted = "No project". */
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  projectId?: string | null;
}

export class UpdateProcessDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  /** Move it to another project; null moves it to "No project". */
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  projectId?: string | null;
}
