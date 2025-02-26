// src/file-management/file-management.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import storageConfig from './config/storage.config';
import { FileManagementController } from './file-management.controller';
import { FileManagementService } from './file-management.service';
import { MediaController } from './media.controller';

@Module({
  imports: [
    ConfigModule.forFeature(storageConfig),
    MulterModule.register({
      dest: process.env.MEDIA_STORAGE_BASE_PATH,
    }),
    AuthModule,
  ],
  controllers: [FileManagementController],
  providers: [FileManagementService],
  exports: [FileManagementService],
})
export class FileManagementModule {}
