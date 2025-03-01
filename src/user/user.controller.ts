import { Body, Controller, Delete, Post, Put, UseGuards , Get , NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { UpdateUserInterestsDto } from './dtos/update-user-interests.dto';
import { UserService } from './user.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private userService: UserService) {}

  @Post('interests')
  addInterests( 
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateUserInterestsDto,
  ) {
    return this.userService.addInterests(user.id, dto.interestIds);
  }

  @Delete('interests')
  removeInterests(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateUserInterestsDto,
  ) {
    return this.userService.removeInterests(user.id, dto.interestIds);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getUserProfile(@CurrentUser() user: CurrentUserType) {
    const profile = await this.userService.getUserProfile(user.id);
    
    if (!profile) {
      throw new NotFoundException(`User with ID ${user.id} not found`);
    }
    
    return {
      success: true,
      data: profile,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUserProfile(@CurrentUser() user: CurrentUserType) {
    const profile = await this.userService.getUserProfile(user.id);
    
    if (!profile) {
      throw new NotFoundException('User profile not found');
    }
    
    return {
      success: true,
      data: profile,
    };
  }


  // Replace all user's interests
  @Put('interests')
  updateInterests(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateUserInterestsDto,
  ) {
    return this.userService.updateInterests(user.id, dto.interestIds);
  }
}
