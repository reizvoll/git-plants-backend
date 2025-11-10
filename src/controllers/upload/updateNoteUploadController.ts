import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';

// upload update note images
export const uploadUpdateNoteImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.image?.[0] || !files.imageKo?.[0]) {
      return res.status(400).json({ message: 'Both image and imageKo are required' });
    }

    // SuperUser validation is already done in adminAuth middleware

    const filename = req.body.filename || files.image[0].originalname;
    const filenameKo = req.body.filenameKo || files.imageKo[0].originalname;

    // Upload English image to Cloudinary
    const result = await uploadToCloudinary(
      files.image[0],
      'git-plants(update-notes)',
      'images/updates',
      filename
    );

    // Upload Korean image to Cloudinary
    const resultKo = await uploadToCloudinary(
      files.imageKo[0],
      'git-plants(update-notes)',
      'images/updates',
      filenameKo
    );

    res.json({
      data: {
        imageUrls: [result.secure_url, resultKo.secure_url],
        publicIds: [result.public_id, resultKo.public_id],
        filenames: [filename, filenameKo]
      }
    });
  } catch (error) {
    console.error('Update note image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};
