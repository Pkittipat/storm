import { IsNotEmpty, IsString } from 'class-validator';

export class ChooseRepoDto {
  @IsString()
  @IsNotEmpty()
  installationId!: string;

  @IsString()
  @IsNotEmpty()
  owner!: string;

  @IsString()
  @IsNotEmpty()
  repo!: string;
}
