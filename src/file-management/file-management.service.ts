import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlink,
  writeFileSync,
  copyFileSync,
} from 'fs';
import { extname, join, dirname } from 'path';
import * as sharp from 'sharp';
import { formatTimestamp } from 'src/utils/timestamp-formatter';
import { promisify } from 'util';
import * as rimraf from 'rimraf';
import * as os from 'os';
import { EventEmitter } from 'events';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Increase default max listeners for all EventEmitter instances
EventEmitter.defaultMaxListeners = 30;

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
  private readonly storagePath: string;
  private readonly cpuCount: number;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.storagePath = this.configService.get('storage.baseStorageDir');
    this.projectPath = join(
      this.storagePath,
      this.configService.get('storage.projectName'),
    );

    // Get CPU count for optimal threading
    this.cpuCount = os.cpus().length;
    this.logger.log(`System has ${this.cpuCount} CPU cores available`);

    // Set FFmpeg path based on environment
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      ffmpeg.setFfmpegPath('C:/Program Files/ffmpeg/bin/ffmpeg.exe');
    } else {
      // In Linux container, use the installed ffmpeg
      ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');
    }

    // Initialize storage directories
    this.initializeStorage();
  }

  private initializeStorage() {
    try {
      const projectPath = this.projectPath;
      const imagesPath = join(projectPath, 'images');
      const videosPath = join(projectPath, 'videos');
      const convertedPath = join(videosPath, 'converted');

      const directories = [
        this.storagePath,
        projectPath,
        imagesPath,
        videosPath,
        convertedPath,
      ];

      for (const dir of directories) {
        if (!existsSync(dir)) {
          this.logger.log(`Creating directory: ${dir}`);
          mkdirSync(dir, { recursive: true, mode: 0o777 });
        }
      }

      this.logger.log('Storage directories initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize storage directories:', error);
      throw new Error(`Failed to initialize storage: ${error.message}`);
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
      // Process all files in parallel
      await Promise.all(
        files.map(async (file) => {
          try {
            const result = await this.processFile(
              file,
              file.mimetype.startsWith('image/') ? 'images' : 'videos',
            );
            results.push(result);
          } catch (error) {
            errors.push({ file: file.originalname, error: error.message });
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error during file processing:', error);
      throw new BadRequestException('File processing failed');
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

  async saveFile(file: Express.Multer.File): Promise<ProcessedFileResult> {
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

      const maxSize = config.maxSize || 100 * 1024 * 1024; // Default 100MB if not specified
      if (file.size > maxSize) {
        throw new BadRequestException(
          `File ${file.originalname} too large. Maximum size: ${maxSize / 1024 / 1024}MB`,
        );
      }

      const fileName =
        type === 'images'
          ? this.generateFileName(file.originalname, '.webp')
          : this.generateFileName(file.originalname);

      if (type === 'images') {
        // Process image (convert to webp and resize)
        processedFilePath = await this.processImage(file.path);

        // Define the destination path within the storage directory
        const destinationPath = join(this.projectPath, type, fileName);

        // Ensure the directory exists
        const dirPath = dirname(destinationPath);
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }

        // Copy the processed file to the destination
        copyFileSync(processedFilePath, destinationPath);

        // Set permissions
        try {
          const fs = require('fs');
          fs.chmodSync(destinationPath, 0o644);
        } catch (chmodError) {
          this.logger.warn(
            `Could not set permissions for ${destinationPath}: ${chmodError.message}`,
          );
        }

        const fileStats = statSync(destinationPath);
        const relativePath = `${type}/${fileName}`;

        // Clean up temporary processed file
        await this.cleanupLocalFile(processedFilePath);

        return {
          originalName: file.originalname,
          fileName: fileName,
          path: this.getPublicPath(relativePath),
          size: fileStats.size,
          mimeType: 'image/webp',
        };
      } else {
        // Process video and generate HLS files
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

    // Temporary directory for processing
    const tempOutputDir = join(os.tmpdir(), `video-processing-${Date.now()}`);
    if (!existsSync(tempOutputDir)) {
      mkdirSync(tempOutputDir, { recursive: true });
    }

    // Final destination in the storage directory
    const finalOutputDir = join(
      this.projectPath,
      'videos',
      'converted',
      baseFileName,
    );
    if (!existsSync(finalOutputDir)) {
      mkdirSync(finalOutputDir, { recursive: true });
    }

    // Define master playlist path
    const masterPlaylistPath = join(tempOutputDir, `${baseFileName}.m3u8`);

    // Mobile-optimized resolutions with 9:16 ratio
    const qualities = [
      { name: '720p', width: 720, height: 1280, bitrate: '2000k' },
      { name: '360p', width: 360, height: 640, bitrate: '800k' },
      { name: '144p', width: 144, height: 256, bitrate: '200k' },
    ];

    // Optimize settings based on file size
    const fileStats = statSync(localFilePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    // For very small files, use ultrafast preset, for larger files use veryfast
    const preset = fileSizeMB < 10 ? 'ultrafast' : 'veryfast';
    // Adjust CRF based on file size
    const crf = fileSizeMB < 20 ? 28 : 26;

    this.logger.log(
      `Video size: ${fileSizeMB.toFixed(2)}MB, processing to mobile-optimized 9:16 ratio`,
    );

    // Process each quality variant sequentially
    for (const quality of qualities) {
      try {
        await new Promise<void>((resolve, reject) => {
          const variantOutputPath = join(
            tempOutputDir,
            `${baseFileName}_${quality.name}.m3u8`,
          );

          // Force resize to exact dimensions without maintaining aspect ratio (will stretch)
          const scaleFilter = `scale=${quality.width}:${quality.height}:force_original_aspect_ratio=disable`;

          ffmpeg(videoPath)
            // Basic settings only
            .addOption('-preset', preset)
            .addOption('-crf', crf.toString())

            // Force the video to stretch to the exact dimensions
            .addOption('-vf', scaleFilter)

            // Video and audio codecs
            .addOption('-c:v', 'libx264')
            .addOption('-c:a', 'aac')
            .addOption('-b:a', '128k')

            // HLS settings
            .addOption('-hls_time', '10')
            .addOption('-hls_list_size', '0')
            .addOption(
              '-hls_segment_filename',
              join(tempOutputDir, `${baseFileName}_${quality.name}_%03d.ts`),
            )

            // Output file path
            .output(variantOutputPath)

            // Event handlers
            .on('start', (cmdline) => {
              this.logger.debug(`FFmpeg command: ${cmdline}`);
            })
            .on('progress', (progress) => {
              const percent = progress.percent
                ? Number(progress.percent).toFixed(2)
                : '0.00';
              this.logger.debug(`Processing ${quality.name}: ${percent}% done`);
            })
            .on('end', () => {
              this.logger.log(`Finished processing ${quality.name} variant`);
              resolve();
            })
            .on('error', (err) => {
              this.logger.error(
                `Error processing ${quality.name} variant:`,
                err,
              );
              reject(err);
            })
            .run();
        });
      } catch (error) {
        this.logger.error(
          `Failed to process ${quality.name} variant: ${error.message}`,
        );
        // Continue with next quality
      }
    }

    // Create master playlist only with successfully created variants
    let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
    let hasSuccessfulVariant = false;

    for (const quality of qualities) {
      const variantPath = join(
        tempOutputDir,
        `${baseFileName}_${quality.name}.m3u8`,
      );
      if (existsSync(variantPath)) {
        const bandwidth = parseInt(quality.bitrate) * 1000;
        masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${quality.width}x${quality.height},NAME="${quality.name}"\n`;
        masterContent += `${baseFileName}_${quality.name}.m3u8\n`;
        hasSuccessfulVariant = true;
      }
    }

    // Only write master playlist if at least one variant was successfully created
    if (hasSuccessfulVariant) {
      writeFileSync(masterPlaylistPath, masterContent);
    } else {
      throw new BadRequestException(
        'Failed to process video into any quality variant',
      );
    }

    // Clean up the original uploaded file
    await this.cleanupLocalFile(localFilePath);

    try {
      // Find all generated files
      const files = readdirSync(tempOutputDir).filter((file) =>
        /\.(m3u8|ts)$/.test(file),
      );

      if (files.length === 0) {
        throw new Error('No video files were generated during transcoding');
      }

      // Move all files from temp directory to final destination
      for (const file of files) {
        const sourcePath = join(tempOutputDir, file);
        const destPath = join(finalOutputDir, file);

        // Ensure destination directory exists
        if (!existsSync(dirname(destPath))) {
          mkdirSync(dirname(destPath), { recursive: true });
        }

        // Copy the file to the destination
        copyFileSync(sourcePath, destPath);

        // Set permissions
        try {
          const fs = require('fs');
          fs.chmodSync(destPath, 0o644);
        } catch (chmodError) {
          this.logger.warn(
            `Could not set permissions for ${destPath}: ${chmodError.message}`,
          );
        }

        // Clean up source file
        await this.cleanupLocalFile(sourcePath);
      }

      // Clean up the entire temp directory after all files are moved
      this.logger.log(
        `Cleaning up temporary output directory: ${tempOutputDir}`,
      );
      rimraf.sync(tempOutputDir);
    } catch (error) {
      this.logger.error(`Error during file handling: ${error.message}`);
      // Clean up temp directory even on error
      try {
        rimraf.sync(tempOutputDir);
      } catch (e) {
        this.logger.error(`Failed to clean up temp directory: ${e.message}`);
      }
    }

    return join(finalOutputDir, `${baseFileName}.m3u8`);
  }

  private async processImage(localFilePath: string): Promise<string> {
    const webpPath = `${localFilePath}.webp`;

    try {
      // Mobile-optimized dimensions (9:16 ratio)
      const targetWidth = 720;
      const targetHeight = 1280;

      this.logger.log(
        `Processing image to mobile-optimized 9:16 aspect ratio (${targetWidth}x${targetHeight})`,
      );

      // Resize the image to exactly fit the target dimensions (will stretch)
      await sharp(localFilePath)
        .resize({
          width: targetWidth,
          height: targetHeight,
          fit: 'fill', // This forces the exact dimensions without preserving aspect ratio
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
    return `ANYCODE-${nameWithoutExtension}-${timestamp}_${random}${
      ext.startsWith('.') ? ext : '.' + ext
    }`;
  }

  private getPublicPath(relativePath: string): string {
    return `http://anycode-sy.com/media/${this.configService.get(
      'storage.projectName',
    )}/${relativePath}`;
  }
}
