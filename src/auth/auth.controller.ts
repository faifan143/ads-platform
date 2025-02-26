// src/auth/auth.controller.ts
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { SignInDto, SignUpDto } from './dtos/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { Admin } from './decorators/admin.decorator';
import { CurrentUserType } from './types/current-user.type';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() dto: SignUpDto) {
    try {
      const user = await this.authService.signUp(dto);
      return { message: 'User created successfully', user };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong');
    }
  }

  @Post('signin')
  async signIn(@Body() dto: SignInDto) {
    if (dto.phone === '0912345678' && dto.password === 'anyCode2024@admin123') {
      // For admin, generate a token with role='admin'
      const token = await this.authService.generateToken('admin', dto.phone);
      return { message: 'Admin Signed in successfully', token };
    }

    const { user } = await this.authService.signIn(dto);
    const token = await this.authService.generateToken(user.id, user.phone);

    return { message: 'Signed in successfully', data: { ...user, token } };
  }

  @Post('signout')
  @UseGuards(JwtAuthGuard)
  async signOut() {
    return { message: 'Signed out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@CurrentUser() user: CurrentUserType) {
    return user;
  }

  // Example of an admin-only route
  @Get('admin-dashboard')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Admin()
  getAdminDashboard() {
    return { message: 'Welcome to the admin dashboard' };
  }
}
