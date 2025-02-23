import { AdType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsPhoneNumber } from 'class-validator';

export class FindAllContentDto {
  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsPhoneNumber()
  ownerNumber?: string;

  @IsOptional()
  @IsEnum(AdType)
  type?: AdType;

  @IsOptional()
  @IsString()
  interestId?: string;
}
