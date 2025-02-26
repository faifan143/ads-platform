import { IsNumber, IsPositive } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class GenerateGemDto {
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value))
  points: number;
}