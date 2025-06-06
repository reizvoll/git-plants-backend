import { adminAuth } from '@/middlewares/authMiddleware';
import { PrismaClient } from '@prisma/client';
import express, { Response } from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';
import { AuthRequest } from '../types/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// set type for cloudinary upload result
interface CloudinaryUploadResult {
  secure_url: string;
  [key: string]: any;
}

// set multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// common upload function
const uploadToCloudinary = async (file: Express.Multer.File, preset: string, folder: string, filename?: string): Promise<CloudinaryUploadResult> => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        upload_preset: preset,
        folder: folder,
        public_id: filename
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as CloudinaryUploadResult);
      }
    ).end(file.buffer);
  });
};

// upload crop image
router.post('/crops', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(crops)', 'images/crops', filename);
    
    // save image info to DB
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        type: 'CROP',
        name: filename,
        url: result.secure_url
      }
    });

    res.json({ success: true, data: { ...result, dbRecord: uploadedImage } });
  } catch (error) {
    console.error('작물 이미지 업로드 에러:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

// upload background image
router.post('/backgrounds', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(backgrounds)', 'items/backgrounds', filename);
    
    // save image info to DB
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        type: 'BACKGROUND',
        name: filename,
        url: result.secure_url
      }
    });

    res.json({ success: true, data: { ...result, dbRecord: uploadedImage } });
  } catch (error) {
    console.error('배경화면 이미지 업로드 에러:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

// upload pot image
router.post('/pots', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(pots)', 'items/pots', filename);
    
    // save image info to DB
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        type: 'POT',
        name: filename,
        url: result.secure_url
      }
    });

    res.json({ success: true, data: { ...result, dbRecord: uploadedImage } });
  } catch (error) {
    console.error('화분 이미지 업로드 에러:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

// upload badge image
router.post('/badges', upload.single('image'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const { name, condition } = req.body;
    
    // Validate required fields
    if (!name || !condition) {
      return res.status(400).json({ message: '뱃지 이름과 획득 조건이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(badges)', 'images/badges', filename);
    
    // Create both UploadedImage and Badge records
    const [uploadedImage, badge] = await prisma.$transaction([
      prisma.uploadedImage.create({
        data: {
          type: 'BADGE',
          name: filename,
          url: result.secure_url
        }
      }),
      prisma.badge.create({
        data: {
          name,
          condition,
          imageUrl: result.secure_url,
          updatedById: req.user!.id
        }
      })
    ]);

    res.json({ 
      success: true, 
      data: { 
        ...result, 
        uploadedImage,
        badge 
      } 
    });
  } catch (error) {
    console.error('뱃지 이미지 업로드 에러:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

export default router; 