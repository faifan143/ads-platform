// src/interest/interest.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInterestDto, UpdateInterestDto } from './dtos/interest.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InterestService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInterestDto) {
    try {
      if (dto.maxAge < dto.minAge) {
        throw new BadRequestException(
          'Maximum age must be greater than minimum age',
        );
      }

      const existing = await this.prisma.interest.findUnique({
        where: { name: dto.name },
      });

      if (existing) {
        throw new ConflictException(
          'An interest with this name already exists',
        );
      }

      const interest = await this.prisma.interest.create({
        data: {
          name: dto.name,
          targetedGender: dto.targetedGender || null,
          minAge: dto.minAge,
          maxAge: dto.maxAge,
        },
      });

      return interest;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An interest with this name already exists',
          );
        }
      }
      throw error;
    }
  }

  async findAll() {
    return this.prisma.interest.findMany();
  }

  async findById(id: string) {
    const interest = await this.prisma.interest.findUnique({
      where: { id },
    });

    if (!interest) {
      throw new NotFoundException(`Interest with ID ${id} not found`);
    }

    return interest;
  }

  async findByName(name: string) {
    const interest = await this.prisma.interest.findUnique({
      where: { name },
    });

    if (!interest) {
      throw new NotFoundException(`Interest with name ${name} not found`);
    }

    return interest;
  }

  async update(id: string, dto: UpdateInterestDto) {
    const filteredDto = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );

    try {
      // Check if interest exists
      const existing = await this.findById(id);

      // Validate age range
      const newMinAge = filteredDto.minAge ?? existing.minAge;
      const newMaxAge = filteredDto.maxAge ?? existing.maxAge;

      if (newMaxAge < newMinAge) {
        throw new BadRequestException(
          'Maximum age must be greater than minimum age',
        );
      }

      return await this.prisma.interest.update({
        where: { id },
        data: {
          name: filteredDto.name,
          targetedGender: filteredDto.targetedGender,
          minAge: filteredDto.minAge,
          maxAge: filteredDto.maxAge,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'An interest with this name already exists',
          );
        }
      }
      throw error;
    }
  }

  async delete(id: string) {
    try {
      await this.findById(id); // Check if exists first
      await this.prisma.interest.delete({
        where: { id },
      });
      return { message: 'Interest deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete interest');
    }
  }
}
