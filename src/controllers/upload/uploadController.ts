import cloudinary from '@/config/cloudinary';
import { UploadApiResponse } from 'cloudinary';
import multer from 'multer';
import path from 'path';

// set multer storage
const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });

// common upload function
export const uploadToCloudinary = async (
  file: Express.Multer.File,
  preset: string,
  folder: string,
  filename?: string
): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    // Remove file extension from public_id to prevent duplicate extensions
    const publicId = filename ? path.parse(filename).name : undefined;

    cloudinary.uploader.upload_stream(
      {
        upload_preset: preset,
        folder: folder,
        public_id: publicId
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadApiResponse);
      }
    ).end(file.buffer);
  });
};

// Constants for plant stages
export const PLANT_STAGES = ['seed', 'sprout', 'growing', 'mature'] as const;