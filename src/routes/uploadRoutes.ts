import { upload } from '@/controllers/upload/uploadController';
import { uploadPlantImage } from '@/controllers/upload/plantUploadController';
import { uploadBackgroundImage, uploadPotImage } from '@/controllers/upload/gardenItemUploadController';
import { uploadBadgeImage } from '@/controllers/upload/badgeUploadController';
import { uploadUpdateNoteImage } from '@/controllers/upload/updateNoteUploadController';
import { adminAuth } from '@/middlewares/authMiddleware';
import express from 'express';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// upload plant image
router.post('/plants', upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 },
  { name: 'cropImage', maxCount: 1 },
  { name: 'seed', maxCount: 1 },
  { name: 'sprout', maxCount: 1 },
  { name: 'growing', maxCount: 1 },
  { name: 'mature', maxCount: 1 },
  { name: 'harvest', maxCount: 1 },
]), uploadPlantImage);

// upload background image
router.post('/backgrounds', upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 }
]), uploadBackgroundImage);

// upload pot image
router.post('/pots', upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 }
]), uploadPotImage);

// upload badge image
router.post('/badges', upload.single('image'), uploadBadgeImage);

// upload update-note image
router.post('/update-notes', upload.single('image'), uploadUpdateNoteImage);

export default router; 