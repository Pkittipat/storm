import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProcessDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

export class UpdateProcessDto extends CreateProcessDto {}
