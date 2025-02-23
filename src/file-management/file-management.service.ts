import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import { existsSync, mkdirSync, statSync, unlink } from 'fs';
import { extname, join } from 'path';
import * as sharp from 'sharp';
import * as SftpClient from 'ssh2-sftp-client';
import { promisify } from 'util';

const unlinkAsync = promisify(unlink);

@Injectable()
export class FileManagementService {
  private readonly logger = new Logger(FileManagementService.name);
  private readonly projectPath: string;
  private readonly vpsConfig: any;

  constructor(private configService: ConfigService) {
    this.projectPath = this.configService.get('storage').getProjectPath();
    this.vpsConfig = this.configService.get('storage.vps');
    ffmpeg.setFfmpegPath('C:/Program Files/ffmpeg/bin/ffmpeg.exe');

    this.initializeStorage();
  }

  private initializeStorage() {
    // Set umask to ensure new directories get correct permissions
    process.umask(0);

    if (!existsSync(this.projectPath)) {
      mkdirSync(this.projectPath, { recursive: true });
    }

    const structure = this.configService.get('storage.structure');
    Object.values(structure).forEach(
      ({ path }: { path: string; allowedTypes: string[] }) => {
        const fullPath = join(this.projectPath, path);
        if (!existsSync(fullPath)) {
          mkdirSync(fullPath, { recursive: true, mode: 0o775 }); // Explicitly set mode
        }
      },
    );
  }

  async saveFile(file: Express.Multer.File, type: 'images' | 'videos') {
    let processedFilePath: string | null = null;

    try {
      // Validate file
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      const config = this.configService.get('storage.structure')[type];

      if (!config.allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`,
        );
      }

      if (file.size > config.maxSize) {
        throw new BadRequestException(
          `File too large. Maximum size: ${config.maxSize / 1024 / 1024}MB`,
        );
      }

      // Generate filename without extension for images (we'll add .webp later)
      const fileName =
        type === 'images'
          ? this.generateFileName(file.originalname, '.webp') // Force .webp extension for images
          : this.generateFileName(file.originalname);

      const relativePath = `${type}/${fileName}`;

      // Process file based on type
      if (type === 'images') {
        processedFilePath = await this.processImage(file.path);
        await this.uploadToVPS(
          processedFilePath,
          `${this.vpsConfig.basePath}/${relativePath}`,
        );
      } else if (type === 'videos') {
        const baseFileName = fileName.replace(/\.[^/.]+$/, '');
        const processedDir = `${this.projectPath}/videos/converted/${baseFileName}`;
        processedFilePath = await this.processVideo(file.path, fileName);

        // Wait for all versions to be uploaded and mapped
        const versions = await Promise.all(
          ['1080p', '720p', '480p', '360p', '240p', '144p'].map(
            async (quality) => {
              const versionPath = join(
                processedDir,
                `${baseFileName}-${quality}.mp4`,
              );
              const versionRelativePath = `videos/converted/${baseFileName}/${baseFileName}-${quality}.mp4`;

              await this.uploadToVPS(
                versionPath,
                `${this.vpsConfig.basePath}/${versionRelativePath}`,
              );

              return {
                quality,
                path: this.getPublicPath(versionRelativePath),
              };
            },
          ),
        );

        return {
          originalName: file.originalname,
          fileName: fileName,
          path: this.getPublicPath(
            `videos/converted/${baseFileName}/${baseFileName}-720p.mp4`,
          ),
          versions, // Now this will be an array of actual objects, not promises
          size: statSync(processedFilePath).size,
          mimeType: file.mimetype,
        };
      }

      const fileStats = await statSync(processedFilePath);

      return {
        originalName: file.originalname,
        fileName: fileName,
        path: this.getPublicPath(relativePath),
        size: type === 'images' ? fileStats.size : file.size,
        mimeType: type === 'images' ? 'image/webp' : file.mimetype,
      };
    } catch (error) {
      // Ensure cleanup on error
      if (processedFilePath) {
        await this.cleanupLocalFile(processedFilePath);
      }
      if (file?.path) {
        await this.cleanupLocalFile(file.path);
      }

      throw error;
    }
  }

  // private async processVideo(
  //   localFilePath: string,
  //   fileName: string,
  // ): Promise<string> {
  //   const videoPath = localFilePath;
  //   const outputDir = `${this.projectPath}/videos/converted/${fileName}`;
  //   const outputPath = `${outputDir}/processed.mp4`;

  //   if (!existsSync(outputDir)) {
  //     mkdirSync(outputDir, { recursive: true });
  //   }

  //   await new Promise<void>((resolve, reject) => {
  //     ffmpeg(videoPath)
  //       .outputOptions([
  //         '-preset fast',
  //         '-g 60',
  //         '-sc_threshold 0',
  //         '-b:v:0 1500k',
  //         '-b:v:1 1000k',
  //         '-b:v:2 500k',
  //         '-b:v:3 250k',
  //         '-b:v:4 150k',
  //         '-b:v:5 100k',
  //       ])
  //       .output(outputPath)
  //       .on('end', () => {
  //         console.log('Video transcoding completed');
  //         resolve();
  //       })
  //       .on('error', (err) => {
  //         console.error('Error during video processing:', err);
  //         reject(err);
  //       })
  //       .run();
  //   });

  //   // Clean up original file after processing
  //   await this.cleanupLocalFile(localFilePath);

  //   return outputPath;
  // }
  private async processVideo(
    localFilePath: string,
    fileName: string,
  ): Promise<string> {
    const videoPath = localFilePath;
    const baseFileName = fileName.replace(/\.[^/.]+$/, '');
    const outputDir = `${this.projectPath}/videos/converted/${baseFileName}`;

    // Define quality versions
    const qualities = [
      { name: '1080p', size: '1920x1080', bitrate: '2000k' },
      { name: '720p', size: '1280x720', bitrate: '1000k' },
      { name: '480p', size: '854x480', bitrate: '600k' },
      { name: '360p', size: '640x360', bitrate: '400k' },
      { name: '240p', size: '426x240', bitrate: '250k' },
      { name: '144p', size: '256x144', bitrate: '150k' },
    ];

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Process all quality versions
    const processedFiles = await Promise.all(
      qualities.map(async (quality) => {
        const outputPath = join(
          outputDir,
          `${baseFileName}-${quality.name}.mp4`,
        );

        await new Promise<void>((resolve, reject) => {
          ffmpeg(videoPath)
            .videoCodec('libx264')
            .videoBitrate(quality.bitrate)
            .size(quality.size)
            .audioCodec('aac')
            .audioBitrate('128k')
            .outputOptions([
              '-preset fast',
              '-movflags +faststart',
              '-profile:v main',
              '-level 3.1',
              '-crf 23',
            ])
            .output(outputPath)
            .on('progress', (progress) => {
              const percent = progress.percent
                ? Number(progress.percent).toFixed(2)
                : '0.00';
              this.logger.debug(`Processing ${quality.name}: ${percent}% done`);
            })
            .on('end', () => {
              this.logger.log(`Video processing completed for ${quality.name}`);
              resolve();
            })
            .on('error', (err) => {
              this.logger.error(
                `Error during video processing for ${quality.name}:`,
                err,
              );
              reject(err);
            })
            .run();
        });

        return {
          quality: quality.name,
          path: outputPath,
        };
      }),
    );

    await this.cleanupLocalFile(localFilePath);

    const defaultVersion = processedFiles.find((f) => f.quality === '720p');
    return defaultVersion.path;
  }
  private async processImage(localFilePath: string): Promise<string> {
    const webpPath = `${localFilePath}.webp`;

    try {
      await sharp(localFilePath)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 80,
          effort: 4,
        })
        .toFile(webpPath);

      // Clean up original file after processing
      await this.cleanupLocalFile(localFilePath);

      return webpPath;
    } catch (error) {
      this.logger.error(`Image processing failed: ${error.message}`);
      await this.cleanupLocalFile(localFilePath);
      throw new BadRequestException('Image processing failed');
    }
  }

  private async uploadToVPS(
    localPath: string,
    remotePath: string,
  ): Promise<void> {
    const sftp = new SftpClient();
    let retries = 3;

    // Normalize the path to remove double slashes
    const normalizedPath = remotePath.replace(/\/+/g, '/');

    while (retries > 0) {
      try {
        await sftp.connect({
          host: this.vpsConfig.host,
          port: this.vpsConfig.port,
          username: this.vpsConfig.username,
          password: this.vpsConfig.password,
          readyTimeout: 10000,
        });

        // Create directory structure recursively
        const dirs = normalizedPath.split('/').filter(Boolean); // Remove empty strings
        let currentPath = '';

        for (const dir of dirs.slice(0, -1)) {
          // Exclude the file name
          currentPath += `/${dir}`;
          try {
            await sftp.mkdir(currentPath, true);
            this.logger.debug(`Created directory: ${currentPath}`);
          } catch (err) {
            if (!err.message.includes('File exists')) {
              throw err;
            }
          }
        }

        await sftp.fastPut(localPath, normalizedPath);
        this.logger.log(`File uploaded to VPS: ${normalizedPath}`);
        break;
      } catch (error) {
        retries--;
        this.logger.error(
          `VPS upload attempt failed (${retries} retries left):`,
          error,
        );

        if (retries === 0) {
          throw new BadRequestException(
            'File upload to VPS failed after multiple attempts',
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } finally {
        await sftp.end();
      }
    }
  }
  private async cleanupLocalFile(filePath: string) {
    try {
      if (existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup file ${filePath}: ${error.message}`);
    }
  }

  private generateFileName(
    originalName: string,
    forceExtension?: string,
  ): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const ext = forceExtension || extname(originalName);

    return `${timestamp}-${random}${ext}`;
  }

  private getPublicPath(relativePath: string): string {
    return `http://anycode-sy.com/media/${this.configService.get('storage.projectName')}/${relativePath}`;
  }
}
