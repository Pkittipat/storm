import { IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class NameDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class CreateProcessDto extends NameDto {
  /** The project to list it under; null or omitted = "No project". */
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  @IsString()
  projectId?: string | null;
}

export class MoveProcessDto {
  /** null moves it to "No project". */
  @ValidateIf((_, v) => v !== null)
  @IsString()
  projectId!: string | null;
}

export class SaveProcessDto {
  /** The whole process as YAML; it is re-parsed, validated and stored in canonical form. */
  @IsString()
  @MaxLength(1_000_000)
  yaml!: string;

  /** The `version` this edit was based on. */
  @IsString()
  @IsNotEmpty()
  baseVersion!: string;
}
