import { AdType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class FindAllContentDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsEnum(AdType)
  type?: AdType;

  @IsOptional()
  @IsUUID()
  interestId?: string;
}
