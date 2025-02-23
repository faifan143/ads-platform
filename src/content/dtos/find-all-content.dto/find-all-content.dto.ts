import { AdType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class FindAllContentDto {
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @Matches(/^09\d{8}$/)
  ownerNumber?: string;

  @IsOptional()
  @IsEnum(AdType)
  type?: AdType;

  @IsOptional()
  @IsString()
  interestId?: string;
}
