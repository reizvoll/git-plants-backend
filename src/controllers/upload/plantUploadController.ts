import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { PLANT_STAGES, uploadToCloudinary } from './uploadController';


const prisma = new PrismaClient();

// upload plant image
export const uploadPlantImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const { name } = req.body;
    
    // Early validation
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Plant name is required' });
    }
    
    // Check required images
    if (!files.mainImage?.[0]) {
      return res.status(400).json({ message: 'Main image is required' });
    }
    
    if (!files.iconImage?.[0]) {
      return res.status(400).json({ message: 'Icon image is required' });
    }
    
    // Check if all growth stage images are provided
    const missingStages = PLANT_STAGES.filter((stage: string) => !files[stage]?.[0]);
    if (missingStages.length > 0) {
      return res.status(400).json({ 
        message: `Missing images for stages: ${missingStages.join(', ')}` 
      });
    }
    
    // Upload main image
    const mainFilename = req.body.mainFilename || files.mainImage[0].originalname;
    const mainResult = await uploadToCloudinary(
      files.mainImage[0], 
      'git-plants(plants)', 
      'images/plants', 
      mainFilename
    );
    
    // Upload icon image
    const iconFilename = req.body.iconFilename || files.iconImage[0].originalname;
    const iconResult = await uploadToCloudinary(
      files.iconImage[0],
      'git-plants(plants)',
      'images/plants',
      iconFilename
    );
    
    // Parallel upload for growth stage images
    const uploadPromises = PLANT_STAGES.map(async (stage) => {
      const file = files[stage][0];
      const filename = `${name.trim()}_${stage}`;
      
      const result = await uploadToCloudinary(
        file, 
        'git-plants(plants)', 
        'images/plants', 
        filename
      );
      return result.secure_url;
    });
    
    // Wait for all growth stage uploads to complete
    const growthImageUrls = await Promise.all(uploadPromises);
    
    // Create plant with all image URLs
    const plant = await prisma.plant.create({
      data: {
        name: name.trim(),
        imageUrls: growthImageUrls,
        userId: req.user!.id,
        stage: 'SEED',
        currentContributions: 0
      }
    });
    
    res.json({ 
      data: { 
        plant,
        mainImage: mainResult,
        iconImage: iconResult,
        growthImages: growthImageUrls
      } 
    });
  } catch (error) {
    console.error('Plant image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};

// upload crop image
export const uploadCropImage = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Image file is required' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(crops)', 'images/crops', filename);
    
    // Create plant directly with image URL (using the uploaded image for SEED stage)
    const plant = await prisma.plant.create({
      data: {
        name: filename,
        imageUrls: [result.secure_url, '', '', '', ''], // SEED stage only, others empty for now
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