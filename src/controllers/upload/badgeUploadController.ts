import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';

const prisma = new PrismaClient();

// upload badge image
export const uploadBadgeImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const { name, condition } = req.body;
    
    // Validate required fields
    if (!name || !condition) {
      return res.status(400).json({ message: 'Badge name and condition are required' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(badges)', 'images/badges', filename);
    
    // Get SuperUser record
    const superUser = await prisma.superUser.findUnique({
      where: { userId: req.user!.id }
    });

    if (!superUser) {
      return res.status(403).json({
        message: 'Not authorized as admin' 
      });
    }
    
    // Create badge directly with image URL
    const badge = await prisma.badge.create({
      data: {
        name,
        condition,
        imageUrl: result.secure_url,
        updatedById: superUser.id
      }
    });

    res.json({ 
      data: { 
        ...result, 
        badge 
      } 
    });
  } catch (error: any) {
    console.error('Badge image upload error:', error);
    if (error.code === 'P2003') {
      return res.status(400).json({ 
        message: 'Admin account does not exist. Please log in again.' 
      });
    }
    res.status(500).json({ message: 'Image upload failed' });
  }
}; 