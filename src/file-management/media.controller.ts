import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Headers,
  Query,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as fs from 'fs';
import * as path from 'path';

@Controller('api/media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  @UseGuards(JwtAuthGuard) // Ensure users are authenticated with JWT
  @Get(':project/:type/:filename')
  async getMedia(
    @Param('project') project: string,
    @Param('type') type: string,
    @Param('filename') filename: string,
    @Headers('authorization') authorization: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    try {
      if (token) {
        try {
          this.jwtService.verify(token, {
            secret: this.configService.get('jwt.mediaSecret'),
          });
        } catch (e) {
          throw new UnauthorizedException(
            'Invalid or expired media access token , ',
            e.message,
          );
        }
      }

      // Construct the file path
      const basePath = this.configService.get('storage.vps.basePath');
      const filePath = path.join(basePath, project, type, filename);

      // Validate the path to prevent directory traversal attacks
      if (!this.isPathSafe(basePath, filePath)) {
        throw new UnauthorizedException('Invalid file path');
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      // Set appropriate content type based on file extension
      const ext = path.extname(filename).toLowerCase();
      switch (ext) {
        case '.webp':
          res.setHeader('Content-Type', 'image/webp');
          break;
        case '.m3u8':
          res.setHeader('Content-Type', 'application/x-mpegURL');
          break;
        case '.ts':
          res.setHeader('Content-Type', 'video/MP2T');
          break;
        default:
          res.setHeader('Content-Type', 'application/octet-stream');
      }

      // Stream the file to the response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      this.logger.error('Error serving media file:', error);
      return res
        .status(error instanceof UnauthorizedException ? 403 : 500)
        .send(
          error instanceof UnauthorizedException
            ? error.message
            : 'Error serving media file',
        );
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get(':project/videos/converted/:folder/:filename')
  async getVideoSegment(
    @Param('project') project: string,
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Headers('authorization') authorization: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    try {
      // If using signed URLs, verify the token (uncomment if needed)
      if (token) {
        try {
          this.jwtService.verify(token, {
            secret: this.configService.get('jwt.mediaSecret'),
          });
        } catch (e) {
          throw new UnauthorizedException(
            'Invalid or expired media access token  , ',
            e.message,
          );
        }
      }

      // Construct the file path for video segments
      const basePath = this.configService.get('storage.vps.basePath');
      const filePath = path.join(
        basePath,
        project,
        'videos',
        'converted',
        folder,
        filename,
      );

      // Validate the path to prevent directory traversal attacks
      if (!this.isPathSafe(basePath, filePath)) {
        throw new UnauthorizedException('Invalid file path');
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      // Set appropriate content type
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.m3u8') {
        res.setHeader('Content-Type', 'application/x-mpegURL');
      } else if (ext === '.ts') {
        res.setHeader('Content-Type', 'video/MP2T');
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
      }

      // Stream the file to the response
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      this.logger.error('Error serving video file:', error);
      return res
        .status(error instanceof UnauthorizedException ? 403 : 500)
        .send(
          error instanceof UnauthorizedException
            ? error.message
            : 'Error serving video file',
        );
    }
  }

  // Helper method to prevent directory traversal attacks
  private isPathSafe(basePath: string, filePath: string): boolean {
    const normalizedBasePath = path.normalize(basePath);
    const normalizedFilePath = path.normalize(filePath);
    return normalizedFilePath.startsWith(normalizedBasePath);
  }
}
