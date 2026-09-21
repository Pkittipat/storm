import { IsNotEmpty, IsString } from 'class-validator';

export class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  sourceId!: string;

  @IsString()
  @IsNotEmpty()
  targetId!: string;
}
