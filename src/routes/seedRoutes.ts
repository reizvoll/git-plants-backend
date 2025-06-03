import prisma from '@/config/db';
import { authToken } from '@/middlewares/authMiddleware';
import { AuthRequest } from '@/types/auth';
import express, { Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authToken);

// Get all user's seeds
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const seeds = await prisma.seed.findMany({
      where: { userId: req.user!.id },
      orderBy: { obtainedAt: 'desc' }
    });
    res.json(seeds);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seeds' });
  }
});

// Get seed by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const seed = await prisma.seed.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!seed) {
      return res.status(404).json({ message: 'Seed not found' });
    }
    
    res.json(seed);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seed' });
  }
});

// Create a new seed
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body;
    
    if (!type) {
      return res.status(400).json({ message: 'Seed type is required' });
    }
    
    const seed = await prisma.seed.create({
      data: {
        type,
        userId: req.user!.id,
      }
    });
    
    res.status(201).json(seed);
  } catch (error) {
    res.status(500).json({ message: 'Error creating seed' });
  }
});

// Update seed
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body;
    
    // Check if seed exists and belongs to user
    const existingSeed = await prisma.seed.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!existingSeed) {
      return res.status(404).json({ message: 'Seed not found' });
    }
    
    const updatedSeed = await prisma.seed.update({
      where: { id: req.params.id },
      data: { type }
    });
    
    res.json(updatedSeed);
  } catch (error) {
    res.status(500).json({ message: 'Error updating seed' });
  }
});

// Delete seed
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    // Check if seed exists and belongs to user
    const seed = await prisma.seed.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!seed) {
      return res.status(404).json({ message: 'Seed not found' });
    }
    
    await prisma.seed.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Seed deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting seed' });
  }
});

export default router; 