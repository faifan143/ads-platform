import { AdType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
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
  @IsUUID()
  owner: string;

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
  mediaUrls: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  interestIds: string[];
}
