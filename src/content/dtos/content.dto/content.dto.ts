import { AdType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
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
  @IsUrl({}, { each: true })
  mediaUrls: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}
