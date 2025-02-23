export interface VideoResponse {
  originalName: string;
  fileName: string;
  path: string;
  versions?: {
    quality: string;
    path: string;
  }[];
  size: number;
  mimeType: string;
}
