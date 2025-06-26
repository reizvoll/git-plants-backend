import cloudinary from '@/config/cloudinary';
import { AuthRequest } from '@/types/auth';
import { PrismaClient } from '@prisma/client';
import { UploadApiResponse } from 'cloudinary';
import { Response } from 'express';
import multer from 'multer';

const prisma = new PrismaClient();

// set multer storage
const storage = multer.memoryStorage();
export const upload = multer({ storage: storage });

// common upload function
const uploadToCloudinary = async (file: Express.Multer.File, preset: string, folder: string, filename?: string): Promise<UploadApiResponse> => {
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

// upload crop image
export const uploadCropImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(crops)', 'images/crops', filename);
    
    // Create plant directly with image URL
    const plant = await prisma.plant.create({
      data: {
        name: filename,
        imageUrl: result.secure_url,
        userId: req.user!.id,
        stage: 'SEED',
        currentContributions: 0
      }
    });

    res.json({ data: { ...result, plant } });
  } catch (error) {
    console.error('Plant image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};

// upload background image
export const uploadBackgroundImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.mainImage?.[0] || !files.iconImage?.[0]) {
      return res.status(400).json({ message: 'Main image and icon image are required' });
    }

    const mainFilename = req.body.mainFilename || files.mainImage[0].originalname;
    const iconFilename = req.body.iconFilename || files.iconImage[0].originalname;
    const mode = req.body.mode || 'DEFAULT';

    // Validate mode
    if (mode !== 'DEFAULT' && mode !== 'GARDEN' && mode !== 'MINI') {
      return res.status(400).json({ message: 'Mode must be either DEFAULT, GARDEN or MINI' });
    }

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
    
    // save image info to DB
    const superUser = await prisma.superUser.findUnique({
      where: { userId: req.user!.id }
    });

    if (!superUser) {
      return res.status(403).json({ 
        message: 'Not authorized as admin' 
      });
    }

    const gardenItem = await prisma.gardenItem.create({
      data: {
        name: mainFilename,
        category: 'background',
        imageUrl: mainResult.secure_url,
        iconUrl: iconResult.secure_url,
        price: parseInt(req.body.price) || 0,
        mode: mode,
        updatedById: superUser.id
      }
    });

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
    
    // save image info to DB
    const superUser = await prisma.superUser.findUnique({
      where: { userId: req.user!.id }
    });

    if (!superUser) {
      return res.status(403).json({ 
        message: 'Not authorized as admin' 
      });
    }

    const gardenItem = await prisma.gardenItem.create({
      data: {
        name: mainFilename,
        category: 'pot',
        imageUrl: mainResult.secure_url,
        iconUrl: iconResult.secure_url,
        price: parseInt(req.body.price) || 0,
        updatedById: superUser.id
      }
    });

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