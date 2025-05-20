import prisma from '@/config/db';
import { authToken } from '@/middlewares/authMiddleware';
import express, { Request, Response } from 'express';

// Extend the Request interface to include user from authenticateToken middleware
interface AuthRequest extends Request {
  user?: {
    id: string;
    githubId: string;
    username: string;
    image?: string;
  };
}

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

// Add a new seed to the user's inventory
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.body;
    
    if (!type) {
      return res.status(400).json({ message: 'Seed type is required' });
    }
    
    const seed = await prisma.seed.create({
      data: {
        userId: req.user!.id,
        type
      }
    });
    
    res.status(201).json(seed);
  } catch (error) {
    res.status(500).json({ message: 'Error adding seed' });
  }
});

// Use a seed to create a new plant
router.post('/:id/plant', async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Plant name is required' });
    }
    
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
    
    // Create transaction to delete seed and create plant
    const result = await prisma.$transaction([
      // Create new plant
      prisma.plant.create({
        data: {
          userId: req.user!.id,
          name,
          stage: 'SEED' // Start at seed stage
        }
      }),
      // Delete the used seed
      prisma.seed.delete({
        where: { id: req.params.id }
      })
    ]);
    
    res.status(201).json({
      message: 'Seed planted successfully',
      plant: result[0] // First element is the created plant
    });
  } catch (error) {
    res.status(500).json({ message: 'Error planting seed' });
  }
});

// Delete a seed
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