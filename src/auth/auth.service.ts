// src/auth/auth.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SignUpDto, SignInDto } from './dtos/auth.dto';
import * as bcrypt from 'bcryptjs';
import { Gender, Prisma, Providence } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async signUp(dto: SignUpDto) {
    console.log('Controller received DTO:', dto);

    try {
      // Password complexity validation
      if (
        !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}/.test(dto.password)
      ) {
        throw new BadRequestException(
          'Password must be at least 8 characters long and include uppercase, lowercase, numbers, and special characters',
        );
      }
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      // Validate interestIds
      if (!dto.interestIds || dto.interestIds.length === 0) {
        throw new BadRequestException('At least one interest must be selected');
      }
      // Validate providence
      if (!Object.values(Providence).includes(dto.providence as Providence)) {
        throw new BadRequestException('Invalid providence value');
      }

      // Validate gender
      if (!Object.values(Gender).includes(dto.gender as Gender)) {
        throw new BadRequestException('Invalid gender value');
      }

      const dateOfBirth = new Date(dto.dateOfBirth);
      if (isNaN(dateOfBirth.getTime())) {
        throw new BadRequestException(
          'Invalid date format. Please use YYYY-MM-DD format',
        );
      }
      // Add age validation
      const age = Math.floor(
        (Date.now() - dateOfBirth.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      );
      if (age < 13 || age > 100) {
        throw new BadRequestException('Age must be between 13 and 100 years');
      }

      // Set time to noon UTC to avoid timezone issues
      dateOfBirth.setUTCHours(12, 0, 0, 0);

      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          password: hashedPassword,
          dateOfBirth,
          gender: dto.gender,
          providence: dto.providence,
          interests: {
            connect: dto.interestIds.map((id) => ({ id })),
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          providence: true,
          interests: {
            select: { id: true, name: true },
          },
        },
      });

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          const field = target?.[0] || 'field';
          throw new ConflictException(`User with this ${field} already exists`);
        }
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      // Log the error for debugging
      console.error('Signup error:', error);
      throw new InternalServerErrorException(
        'An error occurred while creating your account',
      );
    }
  }
  async signIn(dto: SignInDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: {
        interests: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = await this.generateToken(user.id, user.email, user.phone);
    return { token, user };
  }

  async generateToken(userId: string, email: string, phone: string) {
    return this.jwtService.sign(
      { sub: userId, email, phone },
      { expiresIn: '7d' },
    );
  }
}
