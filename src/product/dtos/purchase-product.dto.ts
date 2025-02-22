// src/product/dtos/purchase-product.dto.ts
import { IsUUID } from 'class-validator';

export class PurchaseProductDto {
  @IsUUID()
  productId: string;
}
