import { updatePlantGrowth, createPlant, deletePlant, getPlantById, getPlants, updatePlant, getCurrentMonthPlant } from '@/controllers/item/plantController';
import { clientAuth } from '@/middlewares/clientAuth';
import express from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get current month's available plant
router.get('/current-month', getCurrentMonthPlant);

// Get all user's plants
router.get('/', getPlants);

// Get plant by ID
router.get('/:id', getPlantById);

// Create a new plant
router.post('/', createPlant);

// Update plant
router.patch('/:id', updatePlant);

// Delete plant
router.delete('/:id', deletePlant);

// Plant Growth Update
// Update plant growth based on GitHub activities
router.post('/:userPlantId/update-growth', updatePlantGrowth);

export default router; 