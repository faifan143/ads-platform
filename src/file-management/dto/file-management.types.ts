// src/file-management/types/file.types.ts

export interface ProcessedFileResult {
  originalName: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  versions?: Array<{ quality: string; path: string }>;
}

export type FileType = 'images' | 'videos';
