import { addGrowthLog, createPlant, deletePlant, getPlantById, getPlants, updatePlant } from '@/controllers/item/plantController';
import { clientAuth } from '@/middlewares/authMiddleware';
import express from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get all user's plants
router.get('/', getPlants);

// Get plant by ID
router.get('/:id', getPlantById);

// Create a new plant
router.post('/', createPlant);

// Update plant
router.put('/:id', updatePlant);

// Delete plant
router.delete('/:id', deletePlant);

// Growth Logs
// Add growth log to a plant
router.post('/:plantId/logs', addGrowthLog);

export default router; 