import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlink,
  writeFileSync,
} from 'fs';
import { extname, join } from 'path';
import * as sharp from 'sharp';
import { formatTimestamp } from 'src/utils/timestamp-formatter';
import * as SftpClient from 'ssh2-sftp-client';
import { promisify } from 'util';
import * as rimraf from 'rimraf';

const unlinkAsync = promisify(unlink);
interface ProcessedFileResult {
  originalName: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  versions?: Array<{ quality: string; path: string }>;
}

@Injectable()
export class FileManagementService {
  private readonly logger = new Logger(FileManagementService.name);
  private readonly projectPath: string;
  private readonly vpsConfig: any;
  private sftp: SftpClient;
  private isSftpConnected: boolean = false;

  constructor(private configService: ConfigService) {
    this.sftp = new SftpClient();
    this.projectPath = this.configService.get('storage').getProjectPath();
    this.vpsConfig = this.configService.get('storage.vps');
    ffmpeg.setFfmpegPath('C:/Program Files/ffmpeg/bin/ffmpeg.exe');

    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      // Connect to SFTP
      await this.connectToVPS();

      // Create and set permissions for the main directories
      const basePath = this.vpsConfig.basePath;
      const projectPath = `${basePath}/${this.configService.get('storage.projectName')}`;
      const videosPath = `${projectPath}/videos`;
      const convertedPath = `${videosPath}/converted`;

      const directories = [basePath, projectPath, videosPath, convertedPath];

      for (const dir of directories) {
        try {
          await this.sftp.mkdir(dir, true);
          if (dir.includes('/videos')) {
            await this.sftp.chmod(dir, 0o777);
          }
        } catch (err) {
          if (!err.message.includes('File exists')) {
            this.logger.error(`Failed to create directory ${dir}:`, err);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to initialize storage:', error);
    } finally {
      await this.disconnectSftp();
    }
  }
  async saveFiles(
    files: Express.Multer.File[],
  ): Promise<ProcessedFileResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    const results: ProcessedFileResult[] = [];
    const errors: any[] = [];

    try {
      // Connect to VPS before processing files
      await this.connectToVPS();

      // Process all files
      await Promise.all(
        files.map(async (file) => {
          console.log(3);
          try {
            const result = await this.processFile(
              file,
              file.mimetype.startsWith('image/') ? 'images' : 'videos',
            );
            console.log(4);
            results.push(result);
            console.log(5);
          } catch (error) {
            errors.push({ file: file.originalname, error: error.message });
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error during file processing:', error);
      throw new BadRequestException('File processing failed');
    } finally {
      // Always disconnect SFTP in finally block
      try {
        await this.disconnectSftp();
      } catch (error) {
        this.logger.error('Error disconnecting SFTP:', error);
      }
    }

    // Handle any errors that occurred during processing
    if (errors.length > 0) {
      this.logger.error('Some files failed to process', { errors });
      if (errors.length === files.length) {
        throw new BadRequestException('All files failed to process', {
          cause: errors,
        });
      }
    }

    return results;
  }

  // Modified to handle single file uploads through the multiple file handler
  async saveFile(
    file: Express.Multer.File,
    type: 'images' | 'videos',
  ): Promise<ProcessedFileResult> {
    console.log('file , type : ', file, ' , ', type);

    const results = await this.saveFiles([file]);
    return results[0];
  }

  private async processFile(
    file: Express.Multer.File,
    type: 'images' | 'videos',
  ): Promise<ProcessedFileResult> {
    let processedFilePath: string | null = null;

    try {
      const config = this.configService.get('storage.structure')[type];

      if (!config.allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type for ${file.originalname}. Allowed types: ${config.allowedTypes.join(', ')}`,
        );
      }

      if (file.size > config.maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} too large. Maximum size: ${config.maxSize / 1024 / 1024}MB`,
        );
      }

      const fileName =
        type === 'images'
          ? this.generateFileName(file.originalname, '.webp')
          : this.generateFileName(file.originalname);

      if (type === 'images') {
        processedFilePath = await this.processImage(file.path);
        const relativePath = `${type}/${fileName}`;

        try {
          await this.uploadToVPS(
            processedFilePath,
            `${this.vpsConfig.basePath}/${relativePath}`,
          );
        } catch (error) {
          throw new BadRequestException(
            `Failed to upload file: ${error.message}`,
          );
        }

        const fileStats = await statSync(processedFilePath);
        return {
          originalName: file.originalname,
          fileName: fileName,
          path: this.getPublicPath(relativePath),
          size: fileStats.size,
          mimeType: 'image/webp',
        };
      } else {
        // Process video and get the base path for HLS files
        const baseFileName = fileName.replace(/\.[^/.]+$/, '');
        await this.processVideo(file.path, fileName);

        // For HLS streaming, return the path to the m3u8 file
        return {
          originalName: file.originalname,
          fileName: fileName,
          path: this.getPublicPath(
            `videos/converted/${baseFileName}/${baseFileName}.m3u8`,
          ),
          size: file.size,
          mimeType: 'application/x-mpegURL',
        };
      }
    } catch (error) {
      await this.cleanupFiles(processedFilePath, file?.path);
      throw error;
    }
  }
  // Helper method for file cleanup
  private async cleanupFiles(...filePaths: (string | null | undefined)[]) {
    for (const path of filePaths) {
      if (path) {
        try {
          await this.cleanupLocalFile(path);
        } catch (error) {
          this.logger.warn(`Failed to cleanup file ${path}: ${error.message}`);
        }
      }
    }
  }

  private async processVideo(
    localFilePath: string,
    fileName: string,
  ): Promise<string> {
    const videoPath = localFilePath;
    const baseFileName = fileName.replace(/\.[^/.]+$/, ''); // Extract base filename
    const outputDir = `${this.projectPath}/videos/converted/${baseFileName}`;

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Define master playlist path
    const masterPlaylistPath = join(outputDir, `${baseFileName}.m3u8`);

    // Define quality variants from 144p to 1080p
    const qualities = [
      { name: '720p', resolution: '1280x720', bitrate: '2500k' },
      { name: '360p', resolution: '640x360', bitrate: '600k' },
      { name: '144p', resolution: '256x144', bitrate: '200k' },
    ];

    // Process video into adaptive streaming format
    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(videoPath);

      // Add input options
      command
        .addOption('-preset', 'medium')
        .addOption('-profile:v', 'main')
        .addOption('-crf', '23')
        .addOption('-sc_threshold', '0')
        .addOption('-g', '48')
        .addOption('-keyint_min', '48');

      // Create variant outputs
      qualities.forEach((quality) => {
        command
          .output(join(outputDir, `${baseFileName}_${quality.name}.m3u8`))
          .addOption('-vf', `scale=${quality.resolution.replace('x', ':')}`)
          .addOption('-b:v', quality.bitrate)
          .addOption('-maxrate', `${parseInt(quality.bitrate) * 1.5}k`)
          .addOption('-bufsize', `${parseInt(quality.bitrate) * 2}k`)
          .addOption('-c:v', 'libx264')
          .addOption('-c:a', 'aac')
          .addOption('-b:a', '128k')
          .addOption('-hls_time', '6')
          .addOption('-hls_list_size', '0')
          .addOption('-hls_playlist_type', 'vod')
          .addOption(
            '-hls_segment_filename',
            join(outputDir, `${baseFileName}_${quality.name}_%03d.ts`),
          );
      });

      // Create the master playlist manually after all processing is done
      command
        .on('end', async () => {
          try {
            // Create master playlist content
            let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
            qualities.forEach((quality) => {
              const bandwidth = parseInt(quality.bitrate) * 1000;
              const resolution = quality.resolution;
              masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},NAME="${quality.name}"\n`;
              masterContent += `${baseFileName}_${quality.name}.m3u8\n`;
            });

            // Write master playlist
            writeFileSync(masterPlaylistPath, masterContent);

            this.logger.log('HLS adaptive streaming processing completed');
            resolve();
          } catch (error) {
            reject(error);
          }
        })
        .on('progress', (progress) => {
          const percent = progress.percent
            ? Number(progress.percent).toFixed(2)
            : '0.00';
          this.logger.debug(`Processing HLS: ${percent}% done`);
        })
        .on('error', (err) => {
          this.logger.error('Error during HLS video processing:', err);
          reject(err);
        })
        .run();
    });

    await this.cleanupLocalFile(localFilePath);

    try {
      // Find all generated files (master playlist, variant playlists, and segments)
      const files = readdirSync(outputDir).filter((file) =>
        /\.(m3u8|ts)$/.test(file),
      );

      // Upload files in batches to prevent memory leaks
      const batchSize = 3;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (file) => {
            const localFilePath = join(outputDir, file);
            const remoteFilePath = join(
              this.vpsConfig.basePath,
              'videos',
              'converted',
              baseFileName,
              file,
            ).replace(/\\/g, '/'); // Ensure forward slashes for remote path

            try {
              await this.uploadToVPS(localFilePath, remoteFilePath);
              await this.cleanupLocalFile(localFilePath);
            } catch (error) {
              this.logger.error(`Failed to upload ${file}:`, error);
              throw error;
            }
          }),
        );
      }
      // Clean up the entire output directory after all files are uploaded
      this.logger.log(`Cleaning up local output directory: ${outputDir}`);
      rimraf.sync(outputDir);
    } catch (error) {
      this.logger.error(`Error during file cleanup: ${error.message}`);
      // Don't throw here, since the main operation succeeded
    }

    return masterPlaylistPath;
  }
  async connectToVPS() {
    if (!this.isSftpConnected) {
      await this.sftp.connect({
        host: this.vpsConfig.host,
        port: this.vpsConfig.port,
        username: this.vpsConfig.username,
        password: this.vpsConfig.password,
        readyTimeout: 100000,
      });
      this.isSftpConnected = true;
      this.logger.debug('SFTP connected');
    }
  }

  private async disconnectSftp() {
    if (this.isSftpConnected) {
      await this.sftp.end();
      this.isSftpConnected = false;
      this.logger.debug('SFTP disconnected');
    }
  }

  private async uploadToVPS(
    localPath: string,
    remotePath: string,
  ): Promise<void> {
    let retries = 3;
    const normalizedRemotePath = remotePath.replace(/\\/g, '/');

    this.logger.debug(
      `Uploading from: ${localPath} to: ${normalizedRemotePath}`,
    );

    while (retries > 0) {
      try {
        // Create directory structure recursively
        const dirs = normalizedRemotePath.split('/').slice(0, -1); // Exclude filename
        let currentPath = '';

        for (const dir of dirs) {
          if (!dir) continue; // Skip empty segments
          currentPath += `/${dir}`;
          try {
            await this.sftp.mkdir(currentPath, true);

            // Set directory permissions if it's under videos
            if (currentPath.includes('/videos')) {
              try {
                await this.sftp.chmod(currentPath, 0o777);
              } catch (chmodError) {
                this.logger.warn(
                  `Could not set permissions for ${currentPath}: ${chmodError.message}`,
                );
              }
            }
          } catch (err) {
            if (!err.message.includes('File exists')) {
              throw err;
            }
          }
        }

        // Check if local file exists before uploading
        if (!existsSync(localPath)) {
          throw new Error(`Local file not found: ${localPath}`);
        }

        // Upload the file
        await this.sftp.fastPut(localPath, normalizedRemotePath);

        // Set permissions for the uploaded file if it's under videos
        if (normalizedRemotePath.includes('/videos')) {
          try {
            await this.sftp.chmod(normalizedRemotePath, 0o777);
          } catch (chmodError) {
            this.logger.warn(
              `Could not set permissions for ${normalizedRemotePath}: ${chmodError.message}`,
            );
          }
        }

        this.logger.log(`File uploaded to VPS: ${normalizedRemotePath}`);
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
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
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
    const timestamp = formatTimestamp(Date.now());
    const random = Math.random().toString(36).substring(2, 8);
    const ext = forceExtension || extname(originalName) || '';
    const nameWithoutExtension = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/\s+/g, '_');
    return `ANYCODE-${nameWithoutExtension}-${timestamp}_${random}${ext.startsWith('.') ? ext : '.' + ext}`;
  }

  private getPublicPath(relativePath: string): string {
    return `http://anycode-sy.com/media/${this.configService.get('storage.projectName')}/${relativePath}`;
  }
}
