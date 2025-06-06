import prisma from '@/config/db';
import { clientAuth } from '@/middlewares/authMiddleware';
import { AuthRequest } from '@/types/auth';
import express, { Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// Get all user's plants
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const plants = await prisma.plant.findMany({
      where: { userId: req.user!.id },
      include: { growthLogs: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plants' });
  }
});

// Get plant by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const plant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: { growthLogs: true }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    res.json(plant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plant' });
  }
});

// Create a new plant
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Plant name is required' });
    }
    
    const plant = await prisma.plant.create({
      data: {
        name,
        userId: req.user!.id,
      }
    });
    
    res.status(201).json(plant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating plant' });
  }
});

// Update plant
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    
    // Check if plant exists and belongs to user
    const existingPlant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!existingPlant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const updatedPlant = await prisma.plant.update({
      where: { id: req.params.id },
      data: { name }
    });
    
    res.json(updatedPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating plant' });
  }
});

// Delete plant
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Check if plant exists and belongs to user
    const plant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    await prisma.plant.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting plant' });
  }
});

// Growth Logs
// Add growth log to a plant
router.post('/:plantId/logs', async (req: AuthRequest, res: Response) => {
  try {
    const { log, count } = req.body;
    const { plantId } = req.params;
    
    // Check if plant exists and belongs to user
    const plant = await prisma.plant.findUnique({
      where: {
        id: plantId,
        userId: req.user!.id
      }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const growthLog = await prisma.growthLog.create({
      data: {
        plantId,
        log,
        count
      }
    });
    
    // Update plant's currentContributions
    await prisma.plant.update({
      where: { id: plantId },
      data: { 
        currentContributions: plant.currentContributions + count,
        // Update stage based on new contribution count if needed
        stage: determineGrowthStage(plant.currentContributions + count)
      }
    });
    
    res.status(201).json(growthLog);
  } catch (error) {
    res.status(500).json({ message: 'Error creating growth log' });
  }
});

// Helper function to determine growth stage
function determineGrowthStage(contributions: number): 'SEED' | 'SPROUT' | 'GROWING' | 'MATURE' | 'HARVEST' {
  if (contributions >= 70) return 'HARVEST';
  if (contributions >= 50) return 'MATURE';
  if (contributions >= 30) return 'GROWING';
  if (contributions >= 10) return 'SPROUT';
  return 'SEED';
}

export default router; 