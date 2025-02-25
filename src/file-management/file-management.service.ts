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

// Reusable SFTP connection pool to prevent memory leaks
class SftpConnectionPool {
  private pool: SftpClient[] = [];
  private inUse: Set<SftpClient> = new Set();
  private config: any;
  private logger: Logger;
  private maxSize: number;
  private pendingOperations: number = 0;
  private maxConcurrentOperations: number = 10;

  constructor(config: any, maxSize = 3, logger: Logger) {
    this.config = config;
    this.maxSize = maxSize;
    this.logger = logger;
  }

  async getConnection(): Promise<SftpClient> {
    // Wait if we're at max concurrent operations
    while (this.pendingOperations >= this.maxConcurrentOperations) {
      this.logger.debug(
        `Waiting for SFTP operations to complete (${this.pendingOperations}/${this.maxConcurrentOperations})`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.pendingOperations++;

    // Check for an available connection in the pool
    let client = this.pool.find((c) => !this.inUse.has(c));

    if (!client && this.pool.length < this.maxSize) {
      // Create a new connection if pool isn't at max capacity
      client = new SftpClient();

      try {
        await client.connect({
          host: this.config.host,
          port: this.config.port,
          username: this.config.username,
          password: this.config.password,
          readyTimeout: 100000,
        });
        this.pool.push(client);
        this.logger.debug('Created new SFTP connection');
      } catch (error) {
        this.logger.error('Failed to create SFTP connection:', error);
        this.pendingOperations--;
        throw error;
      }
    }

    if (!client) {
      // Wait for a connection to become available
      this.logger.debug('Waiting for an available SFTP connection');
      await new Promise((resolve) => setTimeout(resolve, 500));
      this.pendingOperations--;
      return this.getConnection();
    }

    this.inUse.add(client);
    return client;
  }

  releaseConnection(client: SftpClient): void {
    this.inUse.delete(client);
    this.pendingOperations = Math.max(0, this.pendingOperations - 1);
  }

  async withConnection<T>(
    operation: (client: SftpClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.getConnection();
    try {
      return await operation(client);
    } finally {
      this.releaseConnection(client);
    }
  }

  async closeAll(): Promise<void> {
    // Wait for all operations to complete
    while (this.pendingOperations > 0) {
      this.logger.debug(
        `Waiting for ${this.pendingOperations} operations to complete before closing connections`,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    for (const client of this.pool) {
      try {
        await client.end();
      } catch (error) {
        this.logger.warn('Error closing SFTP connection:', error);
      }
    }
    this.pool = [];
    this.inUse.clear();
    this.logger.debug('Closed all SFTP connections');
  }
}

@Injectable()
export class FileManagementService {
  private readonly logger = new Logger(FileManagementService.name);
  private readonly projectPath: string;
  private readonly vpsConfig: any;
  private sftpPool: SftpConnectionPool;
  private readonly cpuCount: number;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {
    this.projectPath = this.configService.get('storage').getProjectPath();
    this.vpsConfig = this.configService.get('storage.vps');

    // Get CPU count for optimal threading
    this.cpuCount = os.cpus().length;
    this.logger.log(`System has ${this.cpuCount} CPU cores available`);

    // Set FFmpeg path
    ffmpeg.setFfmpegPath('C:/Program Files/ffmpeg/bin/ffmpeg.exe');

    // Create connection pool for SFTP
    this.sftpPool = new SftpConnectionPool(this.vpsConfig, 3, this.logger);

    // Initialize storage directories
    this.initializeStorage();
    // Setup security for the media directory
    this.setupMediaDirectorySecurity();
  }

  private async initializeStorage() {
    try {
      // Use the withConnection helper for cleaner code
      await this.sftpPool.withConnection(async (sftp) => {
        // Create and set permissions for the main directories
        const basePath = this.vpsConfig.basePath;
        const projectPath = `${basePath}/${this.configService.get('storage.projectName')}`;
        const imagesPath = `${projectPath}/images`;
        const videosPath = `${projectPath}/videos`;
        const convertedPath = `${videosPath}/converted`;

        const directories = [
          basePath,
          projectPath,
          imagesPath,
          videosPath,
          convertedPath,
        ];

        for (const dir of directories) {
          try {
            await sftp.mkdir(dir, true);
            // Set proper permissions to prevent upload errors
            try {
              await sftp.chmod(dir, 0o777);
            } catch (chmodError) {
              this.logger.warn(
                `Could not set permissions for ${dir}: ${chmodError.message}`,
              );
            }
          } catch (err) {
            if (!err.message?.includes('File exists')) {
              this.logger.error(`Failed to create directory ${dir}:`, err);
            }
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize storage:', error);
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
          await this.uploadFileToVPS(
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

    // Define quality variants - reduced to just two for faster processing
    const qualities = [
      { name: '720p', resolution: '1280x720', bitrate: '2000k' },
      { name: '360p', resolution: '640x360', bitrate: '800k' },
      { name: '144p', resolution: '256x144', bitrate: '200k' },
    ];

    // Optimize settings based on file size
    const fileStats = statSync(localFilePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);

    // For very small files, use ultrafast preset, for larger files use veryfast
    const preset = fileSizeMB < 10 ? 'ultrafast' : 'veryfast';
    // Adjust CRF based on file size
    const crf = fileSizeMB < 20 ? 28 : 26;

    this.logger.log(
      `Video size: ${fileSizeMB.toFixed(2)}MB, using preset: ${preset}, CRF: ${crf}`,
    );

    // Create variant outputs concurrently for faster processing
    await Promise.all(
      qualities.map(async (quality) => {
        return new Promise<void>((resolve, reject) => {
          const variantOutputPath = join(
            outputDir,
            `${baseFileName}_${quality.name}.m3u8`,
          );

          ffmpeg(videoPath)
            // Speed optimization: Use faster preset and tune for speed
            .addOption('-preset', preset)
            .addOption('-tune', 'fastdecode')
            // Use a higher CRF for faster encoding (higher number = lower quality but faster)
            .addOption('-crf', crf.toString())
            // Other necessary options
            .addOption('-profile:v', 'main')
            .addOption('-sc_threshold', '0')
            .addOption('-g', '48')
            .addOption('-keyint_min', '48')
            // Output settings
            .output(variantOutputPath)
            .addOption('-vf', `scale=${quality.resolution.replace('x', ':')}`)
            .addOption('-b:v', quality.bitrate)
            .addOption('-maxrate', `${parseInt(quality.bitrate) * 1.5}k`)
            .addOption('-bufsize', `${parseInt(quality.bitrate) * 3}k`) // Increased buffer size
            .addOption('-c:v', 'libx264')
            .addOption('-c:a', 'aac')
            .addOption('-b:a', '128k')
            // Increase segment duration for fewer segments
            .addOption('-hls_time', '10') // Longer segments = fewer files
            .addOption('-hls_list_size', '0')
            .addOption('-hls_playlist_type', 'vod')
            .addOption(
              '-hls_segment_filename',
              join(outputDir, `${baseFileName}_${quality.name}_%03d.ts`),
            )
            // Thread optimization - use half of available cores for each stream
            // to allow parallel processing of multiple qualities
            .addOption(
              '-threads',
              Math.max(1, Math.floor(this.cpuCount / 2)).toString(),
            )
            // Progress and completion handlers
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
      }),
    );

    // Create master playlist
    let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n';
    qualities.forEach((quality) => {
      const bandwidth = parseInt(quality.bitrate) * 1000;
      const resolution = quality.resolution;
      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},NAME="${quality.name}"\n`;
      masterContent += `${baseFileName}_${quality.name}.m3u8\n`;
    });

    // Write master playlist
    writeFileSync(masterPlaylistPath, masterContent);

    // Clean up the original uploaded file
    await this.cleanupLocalFile(localFilePath);

    try {
      // Find all generated files
      const files = readdirSync(outputDir).filter((file) =>
        /\.(m3u8|ts)$/.test(file),
      );

      // First upload the master playlist to ensure the directory structure is created
      const masterPlaylistFile = `${baseFileName}.m3u8`;
      const masterLocalPath = join(outputDir, masterPlaylistFile);
      const masterRemotePath = join(
        this.vpsConfig.basePath,
        'videos',
        'converted',
        baseFileName,
        masterPlaylistFile,
      ).replace(/\\/g, '/');

      await this.uploadFileToVPS(masterLocalPath, masterRemotePath, true);

      // Now upload all variant playlists first (they're small)
      const playlists = files.filter(
        (file) => file.endsWith('.m3u8') && file !== masterPlaylistFile,
      );
      await Promise.all(
        playlists.map((file) => {
          const localFilePath = join(outputDir, file);
          const remoteFilePath = join(
            this.vpsConfig.basePath,
            'videos',
            'converted',
            baseFileName,
            file,
          ).replace(/\\/g, '/');

          return this.uploadFileToVPS(localFilePath, remoteFilePath);
        }),
      );

      // Now upload all segments in batches to prevent overwhelming the connection
      const segments = files.filter((file) => file.endsWith('.ts'));
      const batchSize = 3; // Smaller batch size to prevent too many concurrent connections

      // Process segments in sequential batches to prevent connection issues
      for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);

        // Upload each batch with controlled parallelism
        await Promise.all(
          batch.map(async (file) => {
            const localFilePath = join(outputDir, file);
            const remoteFilePath = join(
              this.vpsConfig.basePath,
              'videos',
              'converted',
              baseFileName,
              file,
            ).replace(/\\/g, '/');

            try {
              await this.uploadFileToVPS(localFilePath, remoteFilePath);
              // Clean up immediately after successful upload
              await this.cleanupLocalFile(localFilePath);
            } catch (error) {
              this.logger.error(`Failed to upload segment ${file}:`, error);
              throw error;
            }
          }),
        );
      }

      // Clean up the entire output directory after all files are uploaded
      this.logger.log(`Cleaning up local output directory: ${outputDir}`);
      rimraf.sync(outputDir);
    } catch (error) {
      this.logger.error(`Error during file upload: ${error.message}`);
    }

    return masterPlaylistPath;
  }

  private async uploadFileToVPS(
    localPath: string,
    remotePath: string,
    ensureDir = false,
  ): Promise<void> {
    let retries = 3;
    const normalizedRemotePath = remotePath.replace(/\\/g, '/');

    this.logger.debug(
      `Uploading from: ${localPath} to: ${normalizedRemotePath}`,
    );

    while (retries > 0) {
      try {
        // Use the withConnection helper to automatically manage the connection
        await this.sftpPool.withConnection(async (sftp) => {
          if (ensureDir) {
            // Create directory structure recursively
            const dirs = normalizedRemotePath.split('/').slice(0, -1); // Exclude filename
            let currentPath = '';

            for (const dir of dirs) {
              if (!dir) continue; // Skip empty segments
              currentPath += `/${dir}`;
              try {
                await sftp.mkdir(currentPath, true);
                // Set directory permissions
                try {
                  await sftp.chmod(currentPath, 0o777);
                } catch (chmodError) {
                  this.logger.warn(
                    `Could not set permissions for ${currentPath}: ${chmodError.message}`,
                  );
                }
              } catch (err) {
                if (!err.message?.includes('File exists')) {
                  throw err;
                }
              }
            }
          }

          // Check if local file exists before uploading
          if (!existsSync(localPath)) {
            throw new Error(`Local file not found: ${localPath}`);
          }

          // Upload the file
          await sftp.fastPut(localPath, normalizedRemotePath);

          // Set permissions for the uploaded file
          try {
            await sftp.chmod(normalizedRemotePath, 0o777);
          } catch (chmodError) {
            this.logger.warn(
              `Could not set permissions for ${normalizedRemotePath}: ${chmodError.message}`,
            );
          }
        });

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
          effort: 4, // Slightly lower effort for faster processing
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

  // private getPublicPath(relativePath: string): string {
  //   return `http://anycode-sy.com/media/${this.configService.get(
  //     'storage.projectName',
  //   )}/${relativePath}`;
  // }

  // Method to sign URLs with expiration time (optional)
  private signUrl(url: string, expirationMinutes = 60): string {
    const expiryTime = Math.floor(Date.now() / 1000) + expirationMinutes * 60;
    const token = this.jwtService.sign(
      { exp: expiryTime },
      { secret: this.configService.get('jwt.mediaSecret') },
    );

    // Add the token as a query parameter
    return `${url}?token=${token}`;
  }
  private getPublicPath(relativePath: string): string {
    const projectName = this.configService.get('storage.projectName');
    const baseUrl = `http://anycode-sy.com/api/media/${projectName}/${relativePath}`;

    // If you want to use signed URLs (more secure), uncomment this line:
    return this.signUrl(baseUrl);

    // For basic auth protection without signed URLs, use this:
    // return baseUrl;
  }

  // Method to create .htaccess for securing the media directory
  private async setupMediaDirectorySecurity(): Promise<void> {
    try {
      await this.sftpPool.withConnection(async () => {
        const basePath = this.vpsConfig.basePath;
        const htaccessContent = `
            # Deny direct access to media files
            <IfModule mod_rewrite.c>
              RewriteEngine On
              RewriteCond %{REQUEST_URI} ^/media/
              RewriteCond %{HTTP_REFERER} !^http://(www\\.)?anycode-sy\\.com/ [NC]
              RewriteRule .* - [F,L]
            </IfModule>

            # Deny access to all
            <IfModule !mod_rewrite.c>
              Order deny,allow
              Deny from all
            </IfModule>
        `;
        // Write .htaccess file to the media directory
        const tempPath = join(this.projectPath, '.htaccess.tmp');
        writeFileSync(tempPath, htaccessContent);

        await this.uploadFileToVPS(tempPath, `${basePath}/.htaccess`, true);
        await unlinkAsync(tempPath).catch((err) =>
          this.logger.warn(
            `Failed to delete temporary .htaccess file: ${err.message}`,
          ),
        );

        this.logger.log('Media directory security setup completed');
      });
    } catch (error) {
      this.logger.error(
        `Failed to setup media directory security: ${error.message}`,
      );
    }
  }

  async onApplicationShutdown() {
    // Close all SFTP connections when the application shuts down
    await this.sftpPool.closeAll();
  }
}
