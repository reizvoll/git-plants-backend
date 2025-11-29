import { upload } from '@/controllers/upload/uploadController';
import { createPlantImage, updatePlantImage } from '@/controllers/upload/plantUploadController';
import { uploadBackgroundImage, uploadPotImage } from '@/controllers/upload/gardenItemUploadController';
import { uploadBadgeImage } from '@/controllers/upload/badgeUploadController';
import { uploadUpdateNoteImage } from '@/controllers/upload/updateNoteUploadController';
import { adminAuth } from '@/middlewares/adminAuth';
import express from 'express';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// create plant images (all images required)
router.post('/plants', upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 },
  { name: 'cropImage', maxCount: 1 },
  { name: 'seed', maxCount: 1 },
  { name: 'sprout', maxCount: 1 },
  { name: 'growing', maxCount: 1 },
  { name: 'mature', maxCount: 1 },
]), createPlantImage);

// update plant images (partial update allowed)
router.patch('/plants', upload.fields([
  { name: 'mainImage', maxCount: 1 },
  { name: 'iconImage', maxCount: 1 },
  { name: 'cropImage', maxCount: 1 },
  { name: 'seed', maxCount: 1 },
  { name: 'sprout', maxCount: 1 },
  { name: 'growing', maxCount: 1 },
  { name: 'mature', maxCount: 1 },
]), updatePlantImage);

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

// upload update-note images
router.post('/update-notes', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'imageKo', maxCount: 1 }
]), uploadUpdateNoteImage);

export default router; 