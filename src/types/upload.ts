import { UploadApiResponse } from 'cloudinary';

export type UploadResult =
  | { type: 'main'; result: UploadApiResponse }
  | { type: 'icon'; result: UploadApiResponse }
  | { type: 'crop'; result: UploadApiResponse }
  | { type: 'stage'; stage: string; result: UploadApiResponse };
