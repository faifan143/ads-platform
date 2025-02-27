export type FileType = 'images' | 'videos';

export interface ProcessedFileResult {
  originalName: string;
  fileName: string;
  path: string;
  size: number;
  mimeType: string;
  mediaType: 'IMAGE' | 'VIDEO';
  posterPath?: string | null;
  versions?: Array<{ quality: string; path: string }>;
}
