import { getActivityById, toggleAutoSync } from '@/controllers/auth/githubController';
import { clientAuth } from '@/middlewares/clientAuth';
import { autoSyncLimiter } from '@/middlewares/rateLimiter';
import express from 'express';

const router = express.Router();
router.use(clientAuth);

// Get contribution details by ID
router.get('/:id', getActivityById);

// Toggle GitHub activities auto sync
router.post('/sync/auto', autoSyncLimiter, toggleAutoSync);

export default router;