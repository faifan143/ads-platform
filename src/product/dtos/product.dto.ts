import { IsString, IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import * as validator from 'validator';
import { IsValidDetails } from 'src/utils/details-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsString()
  photo: string;

  @IsString()
  @IsValidDetails({ message: 'Details must not contain special characters.' })
  details: string;

  @IsInt()
  @Min(1, { message: 'pointsPrice must be at least 1' })
  pointsPrice: number;

  constructor(partial: Partial<CreateProductDto>) {
    Object.assign(this, partial);
    if (this.details) {
      this.details = validator.escape(this.details);
    }
  }
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  photo?: string;

  @IsString()
  @IsOptional()
  @IsValidDetails({ message: 'Details must not contain special characters.' })
  details?: string;

  @IsInt()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  pointsPrice?: number;

  constructor(partial: Partial<UpdateProductDto>) {
    Object.assign(this, partial);
    if (this.details) {
      this.details = validator.escape(this.details);
    }
  }
}
