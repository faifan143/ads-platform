import { AdType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class ContentDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  ownerName: string;

  @IsNotEmpty()
  @Matches(/^09\d{8}$/, {
    message: 'Phone number must be in Syrian format (09XXXXXXXX)',
  })
  ownerNumber: string;

  @IsNotEmpty()
  @IsEnum(AdType)
  type: AdType;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  intervalHours: number;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  endValidationDate: Date;

  @IsArray()
  @IsString({ each: true })
  @Matches(/^http:\/\/anycode-sy\.com\/media\/.*\.(webp|m3u8)$/, {
    message: 'Media URLs must be valid processed files',
    each: true,
  })
  mediaUrls: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}
