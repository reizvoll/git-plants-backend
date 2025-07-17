import {
  getActivityAnalytics,
  getActivityById,
  getActivityStats,
  getUserActivities,
  toggleAutoSync
} from '@/controllers/auth/githubController';
import { clientAuth } from '@/middlewares/authMiddleware';
import { autoSyncLimiter } from '@/middlewares/rateLimiter';
import express from 'express';

const router = express.Router();
router.use(clientAuth);

// Get user's GitHub activities
router.get('/', getUserActivities);

// Get activity statistics
router.get('/stats', getActivityStats);

// Get contribution analytics
router.get('/analytics', getActivityAnalytics);

// Get contribution details by ID
router.get('/:id', getActivityById);

// Toggle GitHub activities auto sync
router.post('/sync/auto', autoSyncLimiter, toggleAutoSync);

export default router;