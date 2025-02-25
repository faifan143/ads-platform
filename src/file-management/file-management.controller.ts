import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ProcessedFileResult } from './dto/file-management.types';
import { FileManagementService } from './file-management.service';

@Controller('files')
// @UseGuards(JwtAuthGuard)
export class FileManagementController {
  constructor(private readonly fileService: FileManagementService) {}

  @Post('upload/images')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProcessedFileResult[]> {
    return this.fileService.saveFiles(files);
  }

  @Post('upload/videos')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadVideos(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ProcessedFileResult[]> {
    return this.fileService.saveFiles(files);
  }

  @Post('upload/image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProcessedFileResult> {
    return this.fileService.saveFile(file);
  }

  @Post('upload/video')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ProcessedFileResult> {
    return this.fileService.saveFile(file);
  }
}
