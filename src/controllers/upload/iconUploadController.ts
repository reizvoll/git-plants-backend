import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';

const prisma = new PrismaClient();

// upload icon image for garden item
export const uploadIconImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const itemId = parseInt(req.params.itemId);
    const filename = req.body.filename || req.file.originalname;

    // Get the garden item to determine its category
    const gardenItem = await prisma.gardenItem.findUnique({
      where: { id: itemId }
    });

    if (!gardenItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Upload icon image to the same folder as the main image
    const result = await uploadToCloudinary(
      req.file,
      `git-plants(${gardenItem.category}s)`,
      `items/${gardenItem.category}s`,
      `${filename}_icon`
    );

    // Update garden item with icon URL
    const updatedItem = await prisma.gardenItem.update({
      where: { id: itemId },
      data: {
        iconUrl: result.secure_url,
        updatedById: req.user!.id
      }
    });

    res.json({ 
      data: { 
        iconImage: result,
        gardenItem: updatedItem 
      } 
    });
  } catch (error) {
    console.error('Icon image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
}; 