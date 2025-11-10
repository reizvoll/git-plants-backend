import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { uploadToCloudinary } from './uploadController';
import { upsertTranslation } from '@/services/translationService';

const prisma = new PrismaClient();

// upload background image
export const uploadBackgroundImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.mainImage?.[0] || !files.iconImage?.[0]) {
      return res.status(400).json({ message: 'Main image and icon image are required' });
    }

    // Parse itemData from JSON
    if (!req.body.itemData) {
      return res.status(400).json({ message: 'Item data is required' });
    }

    const itemData = JSON.parse(req.body.itemData);
    const { name, nameKo, price, mode, isAvailable } = itemData;

    if (!name || price === undefined || !mode) {
      return res.status(400).json({ message: 'Name, price, and mode are required' });
    }

    // Validate mode
    if (mode !== 'DEFAULT' && mode !== 'GARDEN' && mode !== 'MINI') {
      return res.status(400).json({ message: 'Mode must be either DEFAULT, GARDEN or MINI' });
    }

    const mainFilename = req.body.mainFilename || files.mainImage[0].originalname;
    const iconFilename = req.body.iconFilename || files.iconImage[0].originalname;

    // Upload main image
    const mainResult = await uploadToCloudinary(
      files.mainImage[0],
      'git-plants(backgrounds)',
      'items/backgrounds',
      mainFilename
    );

    // Upload icon image
    const iconResult = await uploadToCloudinary(
      files.iconImage[0],
      'git-plants(backgrounds)',
      'items/backgrounds',
      iconFilename
    );

    // SuperUser validation is already done in adminAuth middleware

    const gardenItem = await prisma.gardenItem.create({
      data: {
        name,
        category: 'background',
        imageUrl: mainResult.secure_url,
        iconUrl: iconResult.secure_url,
        price,
        mode,
        isAvailable: isAvailable ?? false,
        updatedById: req.superUser!.id
      }
    });

    // Add Korean translation if provided
    if (nameKo) {
      await upsertTranslation(
        'GardenItem',
        gardenItem.id.toString(),
        'name',
        'ko',
        nameKo
      );
    }

    res.json({
      data: {
        mainImage: mainResult,
        iconImage: iconResult,
        gardenItem
      }
    });
  } catch (error) {
    console.error('Background image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};

// upload pot image
export const uploadPotImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.mainImage?.[0] || !files.iconImage?.[0]) {
      return res.status(400).json({ message: 'Main image and icon image are required' });
    }

    // Parse itemData from JSON
    if (!req.body.itemData) {
      return res.status(400).json({ message: 'Item data is required' });
    }

    const itemData = JSON.parse(req.body.itemData);
    const { name, nameKo, price, isAvailable } = itemData;

    if (!name || price === undefined) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    const mainFilename = req.body.mainFilename || files.mainImage[0].originalname;
    const iconFilename = req.body.iconFilename || files.iconImage[0].originalname;

    // Upload main image
    const mainResult = await uploadToCloudinary(
      files.mainImage[0],
      'git-plants(pots)',
      'items/pots',
      mainFilename
    );

    // Upload icon image
    const iconResult = await uploadToCloudinary(
      files.iconImage[0],
      'git-plants(pots)',
      'items/pots',
      iconFilename
    );

    // SuperUser validation is already done in adminAuth middleware

    const gardenItem = await prisma.gardenItem.create({
      data: {
        name,
        category: 'pot',
        imageUrl: mainResult.secure_url,
        iconUrl: iconResult.secure_url,
        price,
        isAvailable: isAvailable ?? false,
        updatedById: req.superUser!.id
      }
    });

    // Add Korean translation if provided
    if (nameKo) {
      await upsertTranslation(
        'GardenItem',
        gardenItem.id.toString(),
        'name',
        'ko',
        nameKo
      );
    }

    res.json({
      data: {
        mainImage: mainResult,
        iconImage: iconResult,
        gardenItem
      }
    });
  } catch (error) {
    console.error('Pot image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
}; 