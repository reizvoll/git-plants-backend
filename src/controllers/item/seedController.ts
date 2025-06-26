import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// Get user's seed count
export const getSeedCount = async (req: AuthRequest, res: Response) => {
  try {
    const seed = await prisma.seed.findUnique({
      where: { userId: req.user!.id }
    });
    
    res.json(seed || { userId: req.user!.id, count: 0 });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching seed count' });
  }
};

// Add seeds to user
export const addSeeds = async (req: AuthRequest, res: Response) => {
  try {
    const { count } = req.body;
    
    if (!count || count <= 0) {
      return res.status(400).json({ message: 'Valid seed count is required' });
    }
    
    const seed = await prisma.seed.upsert({
      where: { userId: req.user!.id },
      update: {
        count: {
          increment: count
        }
      },
      create: {
        userId: req.user!.id,
        count
      }
    });
    
    res.json(seed);
  } catch (error) {
    res.status(500).json({ message: 'Error adding seeds' });
  }
};

// Use seeds
export const useSeeds = async (req: AuthRequest, res: Response) => {
  try {
    const { count } = req.body;
    
    if (!count || count <= 0) {
      return res.status(400).json({ message: 'Valid seed count is required' });
    }
    
    const seed = await prisma.seed.findUnique({
      where: { userId: req.user!.id }
    });
    
    if (!seed || seed.count < count) {
      return res.status(400).json({ message: 'Not enough seeds' });
    }
    
    const updatedSeed = await prisma.seed.update({
      where: { userId: req.user!.id },
      data: {
        count: {
          decrement: count
        }
      }
    });
    
    res.json(updatedSeed);
  } catch (error) {
    res.status(500).json({ message: 'Error using seeds' });
  }
}; 