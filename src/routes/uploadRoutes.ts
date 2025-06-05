import { PrismaClient } from '@prisma/client';
import express from 'express';
import multer from 'multer';
import cloudinary from '../config/cloudinary';

const router = express.Router();
const prisma = new PrismaClient();

// Cloudinary 응답 타입 정의
interface CloudinaryUploadResult {
  secure_url: string;
  [key: string]: any;
}

// Multer 설정
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 공통 업로드 함수
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

// 작물 이미지 업로드
router.post('/crops', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(crops)', 'images/crops', filename);
    
    // DB에 이미지 정보 저장
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

// 배경화면 이미지 업로드
router.post('/backgrounds', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(backgrounds)', 'items/backgrounds', filename);
    
    // DB에 이미지 정보 저장
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

// 화분 이미지 업로드
router.post('/pots', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(pots)', 'items/pots', filename);
    
    // DB에 이미지 정보 저장
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

// 뱃지 이미지 업로드
router.post('/badges', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '이미지 파일이 필요합니다.' });
    }

    const filename = req.body.filename || req.file.originalname;
    const result = await uploadToCloudinary(req.file, 'git-plants(badges)', 'images/badges', filename);
    
    // DB에 이미지 정보 저장
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        type: 'BADGE',
        name: filename,
        url: result.secure_url
      }
    });

    res.json({ success: true, data: { ...result, dbRecord: uploadedImage } });
  } catch (error) {
    console.error('뱃지 이미지 업로드 에러:', error);
    res.status(500).json({ success: false, message: '이미지 업로드에 실패했습니다.' });
  }
});

export default router; 