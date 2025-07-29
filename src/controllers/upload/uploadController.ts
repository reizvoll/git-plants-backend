import cloudinary from '@/config/cloudinary';
import { UploadApiResponse } from 'cloudinary';
import multer from 'multer';

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
    cloudinary.uploader.upload_stream(
      {
        upload_preset: preset,
        folder: folder,
        public_id: filename
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