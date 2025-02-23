// src/file-management/config/storage.config.ts
import { registerAs } from '@nestjs/config';
import { join } from 'path';

export default registerAs('storage', () => {
  return {
    // Base directory for all media storage (outside of projects)
    baseStorageDir: process.env.MEDIA_STORAGE_BASE_PATH || '/var/www/media',

    // Project-specific settings
    projectName: process.env.PROJECT_NAME || 'reel-win',

    structure: {
      images: {
        path: 'images',
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/jpg',
        ],
      },
      videos: {
        path: 'videos',
        allowedTypes: ['video/mp4', 'video/webm'],
      },
    },

    vps: {
      host: process.env.VPS_HOST,
      port: parseInt(process.env.VPS_PORT || '22', 10),
      username: process.env.VPS_USERNAME,
      password: process.env.VPS_PASSWORD,
      basePath: process.env.MEDIA_STORAGE_BASE_PATH || '/var/www/media',
    },

    // Helper function to get project path
    getProjectPath: function () {
      return join(this.baseStorageDir, this.projectName);
    },
  };
});
