import { getUserProfile, createUserPlant, getCurrentMonthPlant } from '@/controllers/auth/userController';
import express from 'express';
import { clientAuth } from '../middlewares/clientAuth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get user profile with all related information - accessible to both regular users and superusers
router.get('/profile', getUserProfile);

// Get current month's available plant
router.get('/current-month-plant', getCurrentMonthPlant);

// Create a new plant for current user
router.post('/plants', createUserPlant);

export default router; 