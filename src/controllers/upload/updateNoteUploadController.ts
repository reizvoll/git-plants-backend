import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';

const prisma = new PrismaClient();

// upload update note image
export const uploadUpdateNoteImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    // Check if user is SuperUser
    const superUser = await prisma.superUser.findUnique({
      where: { userId: req.user!.id }
    });
    
    if (!superUser) {
      return res.status(403).json({ 
        message: 'Not authorized as admin' 
      });
    }

    const filename = req.body.filename || req.file.originalname;

    // Upload image to Cloudinary
    const result = await uploadToCloudinary(
      req.file,
      'git-plants(update-notes)',
      'images/updates',
      filename
    );

    res.json({ 
      data: { 
        imageUrl: result.secure_url,
        publicId: result.public_id,
        filename: filename
      } 
    });
  } catch (error) {
    console.error('Update note image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};
