import { addSeeds, getSeedCount, useSeeds } from '@/controllers/item/seedController';
import { clientAuth } from '@/middlewares/clientAuth';
import express from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get user's seed count
router.get('/', getSeedCount);

// Add seeds to user
router.post('/add', addSeeds);

// Use seeds
router.post('/use', useSeeds);

export default router; 