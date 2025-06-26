import { createUser, deleteUser, getUser, updateUser } from '@/controllers/auth/authController';
import { getUserProfile } from '@/controllers/auth/userController';
import express from 'express';
import { clientAuth } from '../middlewares/authMiddleware';

const router = express.Router();

// Get user profile with all related information - accessible to both regular users and superusers
router.get('/profile', clientAuth, getUserProfile);

// User routes - these require authentication
router.post('/', clientAuth, createUser);
router.get('/:id', clientAuth, getUser);
router.put('/:id', clientAuth, updateUser);
router.delete('/:id', clientAuth, deleteUser);

export default router; 