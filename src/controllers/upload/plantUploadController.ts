import { Response } from 'express';
import { AuthRequest } from '@/types/auth';
import { UploadResult } from '@/types/upload';
import { PLANT_STAGES, uploadToCloudinary } from './uploadController';

// Create plant images (all fields required)
export const createPlantImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Check if all required images are provided
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
    for (const stage of PLANT_STAGES) {
      if (!files[stage]?.[0]) {
        return res.status(400).json({ message: `${stage} image is required` });
      }
    }

    // SuperUser validation is already done in adminAuth middleware

    const plantName = req.body.plantName || 'plant';

    // Parallel upload all images
    const uploadPromises: Promise<UploadResult>[] = [
      // Main image
      uploadToCloudinary(
        files.mainImage[0],
        'git-plants(plants)',
        'images/plants',
        req.body.mainFilename || files.mainImage[0].originalname
      ).then(result => ({ type: 'main' as const, result })),

      // Icon image
      uploadToCloudinary(
        files.iconImage[0],
        'git-plants(plants)',
        'images/plants',
        req.body.iconFilename || files.iconImage[0].originalname
      ).then(result => ({ type: 'icon' as const, result })),

      // Crop image
      uploadToCloudinary(
        files.cropImage[0],
        'git-plants(crops)',
        'images/crops',
        req.body.cropFilename || files.cropImage[0].originalname
      ).then(result => ({ type: 'crop' as const, result })),

      // Growth stage images
      ...PLANT_STAGES.map(stage =>
        uploadToCloudinary(
          files[stage][0],
          'git-plants(plants)',
          'images/plants',
          `${plantName.trim()}_${stage}`
        ).then(result => ({ type: 'stage' as const, stage, result }))
      )
    ];

    const results = await Promise.all(uploadPromises);

    // Build response data
    const responseData: any = {};
    results.forEach((item: UploadResult) => {
      if (item.type === 'main') {
        responseData.mainImageUrl = item.result.secure_url;
        responseData.mainImage = item.result;
      } else if (item.type === 'icon') {
        responseData.iconUrl = item.result.secure_url;
        responseData.iconImage = item.result;
      } else if (item.type === 'crop') {
        responseData.cropImageUrl = item.result.secure_url;
        responseData.cropImage = item.result;
      } else if (item.type === 'stage') {
        responseData[item.stage] = item.result.secure_url;
      }
    });

    res.json({ data: responseData });
  } catch (error) {
    console.error('Plant image creation error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};

// Update plant images (all fields optional for partial updates)
export const updatePlantImage = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    // Check if at least one file is provided
    const hasAnyFile = Object.keys(files || {}).length > 0;
    if (!hasAnyFile) {
      return res.status(400).json({ message: 'At least one image is required' });
    }

    // SuperUser validation is already done in adminAuth middleware

    const plantName = req.body.plantName || 'plant';
    const uploadPromises: Promise<UploadResult>[] = [];

    // Upload main image if provided
    if (files.mainImage?.[0]) {
      uploadPromises.push(
        uploadToCloudinary(
          files.mainImage[0],
          'git-plants(plants)',
          'images/plants',
          req.body.mainFilename || files.mainImage[0].originalname
        ).then(result => ({ type: 'main' as const, result }))
      );
    }

    // Upload icon image if provided
    if (files.iconImage?.[0]) {
      uploadPromises.push(
        uploadToCloudinary(
          files.iconImage[0],
          'git-plants(plants)',
          'images/plants',
          req.body.iconFilename || files.iconImage[0].originalname
        ).then(result => ({ type: 'icon' as const, result }))
      );
    }

    // Upload crop image if provided
    if (files.cropImage?.[0]) {
      uploadPromises.push(
        uploadToCloudinary(
          files.cropImage[0],
          'git-plants(crops)',
          'images/crops',
          req.body.cropFilename || files.cropImage[0].originalname
        ).then(result => ({ type: 'crop' as const, result }))
      );
    }

    // Upload growth stage images if provided
    PLANT_STAGES.forEach(stage => {
      if (files[stage]?.[0]) {
        uploadPromises.push(
          uploadToCloudinary(
            files[stage][0],
            'git-plants(plants)',
            'images/plants',
            `${plantName.trim()}_${stage}`
          ).then(result => ({ type: 'stage' as const, stage, result }))
        );
      }
    });

    // Parallel upload all provided images
    const results = await Promise.all(uploadPromises);

    // Build response data
    const responseData: any = {};
    results.forEach((item: UploadResult) => {
      if (item.type === 'main') {
        responseData.mainImageUrl = item.result.secure_url;
        responseData.mainImage = item.result;
      } else if (item.type === 'icon') {
        responseData.iconUrl = item.result.secure_url;
        responseData.iconImage = item.result;
      } else if (item.type === 'crop') {
        responseData.cropImageUrl = item.result.secure_url;
        responseData.cropImage = item.result;
      } else if (item.type === 'stage') {
        responseData[item.stage] = item.result.secure_url;
      }
    });

    res.json({ data: responseData });
  } catch (error) {
    console.error('Plant image update error:', error);
    res.status(500).json({ message: 'Image upload failed' });
  }
};