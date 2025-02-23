// src/file-management/file-management.controller.ts
import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileManagementService } from './file-management.service';

@Controller('files')
export class FileManagementController {
  constructor(private readonly fileService: FileManagementService) {}

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.fileService.saveFile(file, 'images');
  }

  @Post('upload/video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    return this.fileService.saveFile(file, 'videos');
  }
}
