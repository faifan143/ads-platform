// src/interest/dtos/interest.dto.ts
import { IsString, IsEnum, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateInterestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(Gender, {
    message: 'targetedGender must be either MALE or FEMALE',
  })
  targetedGender?: Gender | null;

  @IsInt()
  @Type(() => Number)
  @Min(13)
  @Max(100)
  minAge: number;

  @IsInt()
  @Type(() => Number)
  @Min(13)
  @Max(100)
  maxAge: number;
}

export class UpdateInterestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  targetedGender?: Gender;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(13)
  @Max(100)
  minAge?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  @Min(13)
  @Max(100)
  maxAge?: number;
}
