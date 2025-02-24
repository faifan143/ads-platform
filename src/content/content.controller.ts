import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { CurrentUserType } from 'src/auth/types/current-user.type';
import { FileManagementService } from 'src/file-management/file-management.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContentService } from './content.service';
import { ContentDto } from './dtos/content.dto/content.dto';
import { FindAllContentDto } from './dtos/find-all-content.dto/find-all-content.dto';
import { UpdateContentDto } from './dtos/update-content.dto/update-content.dto';

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly fileManagementService: FileManagementService,
  ) {}

  //   admin interactions

  @Post('upload-media')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadContentMedia(
    @UploadedFiles() files: Array<Express.Multer.File>,
  ): Promise<string[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    console.log('pre files : ', files);

    const result = await this.fileManagementService.saveFiles(files);
    return result.map((res) => res.path);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('files'))
  // @UseGuards(JwtAuthGuard)
  create(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() contentDto: Omit<ContentDto, 'mediaUrls'>,
  ) {
    return this.contentService.create(files, contentDto);
  }

  @Get()
  findAll(@Query() query: FindAllContentDto) {
    return this.contentService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contentService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateContentDto: UpdateContentDto) {
    return this.contentService.update(id, updateContentDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.contentService.remove(id);
  }

  //   user interactions
  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  addLike(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.contentService.addLike(id, user.id);
  }

  @Get('user/relevant')
  @UseGuards(JwtAuthGuard)
  findRelevantForUser(@CurrentUser() user: CurrentUserType) {
    return this.contentService.findRelevantForUser(user.id);
  }

  @Post(':id/view')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  markAsViewed(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.contentService.markAsViewed(id, user.id);
  }

  @Get(':id/whatsapp')
  @UseGuards(JwtAuthGuard)
  getWhatsAppLink(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.contentService.getWhatsAppLink(id, user.id);
  }
}
