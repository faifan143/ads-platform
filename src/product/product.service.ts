import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dtos/product.dto';
import { validate } from 'class-validator';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const errors = await validate(dto);
    if (errors.length > 0) {
      throw new BadRequestException(
        'Validation failed: ' + errors.map((e) => e.toString()).join(', '),
      );
    }

    try {
      return await this.prisma.product.create({
        data: dto,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        console.error('Product with this name already exists', error);
        throw new BadRequestException('Product with this name already exists');
      }
      console.error('Error creating product:', error);
      throw new BadRequestException(
        `Failed to create product: ${error.message}`,
      );
    }
  }

  async findAll() {
    try {
      return await this.prisma.product.findMany();
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new BadRequestException('Failed to fetch products');
    }
  }

  async findById(id: string) {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${id} not found`);
      }

      return product;
    } catch (error) {
      console.error(`Error finding product with ID ${id}:`, error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      // Check if product exists
      await this.findById(id);

      const product = await this.prisma.product.update({
        where: { id },
        data: dto,
      });

      return product;
    } catch (error) {
      console.error(`Error updating product with ID ${id}:`, error);
      throw new BadRequestException('Failed to update product');
    }
  }

  async delete(id: string) {
    try {
      await this.findById(id); // Check if exists first
      await this.prisma.product.delete({
        where: { id },
      });
      return { message: 'Product deleted successfully' };
    } catch (error) {
      console.error(`Error deleting product with ID ${id}:`, error);
      throw new BadRequestException('Failed to delete product');
    }
  }

  async purchaseProduct(userId: string, productId: string) {
    // Start a transaction to ensure data consistency
    return this.prisma.$transaction(async (tx) => {
      try {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${productId} not found`);
        }
        if (!product.purchasable) {
          throw new BadRequestException('This product cannot be purchased');
        }

        console.log(`User ${userId} purchasing product ${productId}`);

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, points: true },
        });

        if (!user) {
          throw new NotFoundException(`User with ID ${userId} not found`);
        }

        if (user.points < product.pointsPrice) {
          throw new BadRequestException(
            `Insufficient points. Required: ${product.pointsPrice}, Available: ${user.points}`,
          );
        }

        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            points: {
              decrement: product.pointsPrice,
            },
          },
          select: { id: true, points: true },
        });

        const purchase = await tx.productPurchase.create({
          data: {
            userId,
            productId,
            pointsSpent: product.pointsPrice,
            purchasedAt: new Date(),
          },
        });

        return {
          message: 'Product purchased successfully',
          product,
          remainingPoints: updatedUser.points,
          purchase,
        };
      } catch (error) {
        console.error(`Error purchasing product with ID ${productId}:`, error);
        throw error;
      }
    });
  }
}
