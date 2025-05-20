import { createUser, deleteUser, getUser, updateUser } from '@/controllers/authController';
import express from 'express';
import { authToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authToken);

// User routes
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router; 