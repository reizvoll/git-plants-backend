import {
  upload,
  uploadBackgroundImage,
  uploadBadgeImage,
  uploadCropImage,
  uploadIconImage,
  uploadPotImage
} from '@/controllers/upload/uploadController';
import { adminAuth } from '@/middlewares/authMiddleware';
import express from 'express';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// upload crop image
router.post('/crops', upload.single('image'), uploadCropImage);

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

// upload icon image for garden item
router.post('/icons/:itemId', upload.single('image'), uploadIconImage);

export default router; 