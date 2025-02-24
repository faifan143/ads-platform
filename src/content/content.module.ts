import { Module } from '@nestjs/common';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { FileManagementModule } from 'src/file-management/file-management.module';
import { ConfigModule } from '@nestjs/config';
import storageConfig from 'src/file-management/config/storage.config';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    FileManagementModule,
    ConfigModule.forFeature(storageConfig),
    MulterModule.register({
      dest: process.env.MEDIA_STORAGE_BASE_PATH,
    }),
  ],

  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
