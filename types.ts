export interface ImageFile {
  data: string; // Base64 string
  mimeType: string;
}

export interface ProcessingResult {
  vibrant: string | null;
  natural: string | null;
}

export enum AppStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}
