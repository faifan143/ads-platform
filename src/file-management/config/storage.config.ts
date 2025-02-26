// src/file-management/config/storage.config.ts
import { registerAs } from '@nestjs/config';
import { join } from 'path';

export default registerAs('storage', () => {
  return {
    // Base directory for all media storage (outside of projects)
    baseStorageDir: process.env.MEDIA_STORAGE_BASE_PATH || '/var/www/media',
    
    // Project-specific settings
    projectName: process.env.PROJECT_NAME || 'reel-win',
    
    // File structure and allowed types
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
        maxSize: 10 * 1024 * 1024, // 10MB for images
      },
      videos: {
        path: 'videos',
        allowedTypes: ['video/mp4', 'video/webm'],
        maxSize: 100 * 1024 * 1024, // 100MB for videos
      },
    },
    
    // Helper function to get project path
    getProjectPath: function () {
      return join(this.baseStorageDir, this.projectName);
    },
  };
});