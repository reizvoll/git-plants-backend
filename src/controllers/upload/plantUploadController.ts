import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { PLANT_STAGES, uploadToCloudinary } from './uploadController';

// upload plant images
export const uploadPlantImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    // Check required images
    if (!files.mainImage?.[0]) {
      return res.status(400).json({ message: 'Main image is required' });
    }
    
    if (!files.iconImage?.[0]) {
      return res.status(400).json({ message: 'Icon image is required' });
    }
    
    if (!files.cropImage?.[0]) {
      return res.status(400).json({ message: 'Crop image is required' });
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

    // upload crop image
    const cropFilename = req.body.cropFilename || files.cropImage[0].originalname;
    const cropResult = await uploadToCloudinary(
      files.cropImage[0],
      'git-plants(crops)',
      'images/crops',
      cropFilename
    );
    
    // Parallel upload for growth stage images
    const plantName = req.body.plantName || 'plant';
    const uploadPromises = PLANT_STAGES.map(async (stage) => {
      const file = files[stage][0];
      const filename = `${plantName.trim()}_${stage}`;
      
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
    
    res.json({ 
      data: { 
        mainImage: mainResult,
        iconImage: iconResult,
        growthImages: growthImageUrls,
        imageUrls: growthImageUrls, // createMonthlyPlant에서 사용할 수 있도록
        iconUrl: iconResult.secure_url, // createMonthlyPlant에서 사용할 수 있도록
        cropImageUrl: cropResult.secure_url,
        mainImageUrl: mainResult.secure_url,
      } 
    });
  } catch (error) {
    console.error('Plant image upload error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};