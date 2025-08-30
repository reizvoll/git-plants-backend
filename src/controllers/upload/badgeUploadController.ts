import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';

// upload badge image
export const uploadBadgeImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // SuperUser validation is already done in adminAuth middleware

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(badges)', 'images/badges', filename);
    
    res.json({ 
      data: { 
        imageUrl: result.secure_url,
        publicId: result.public_id,
        filename: filename
      } 
    });
  } catch (error) {
    console.error('Badge image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
}; 