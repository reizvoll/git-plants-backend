import { createUser, deleteUser, getUser, updateUser } from '@/controllers/auth/authController';
import { getUserProfile } from '@/controllers/auth/userController';
import express from 'express';
import { clientAuth } from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get user profile with all related information - accessible to both regular users and superusers
router.get('/profile', getUserProfile);

// User routes - these require authentication
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router; 