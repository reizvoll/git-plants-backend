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

// Use seeds (optionally to purchase item)
export const useSeeds = async (req: AuthRequest, res: Response) => {
  try {
    const { count, itemId } = req.body;
    
    if (!count || count <= 0) {
      return res.status(400).json({ message: 'Valid seed count is required' });
    }

    // Check if user has enough seeds
    const seed = await prisma.seed.findUnique({
      where: { userId: req.user!.id }
    });
    
    if (!seed || seed.count < count) {
      return res.status(400).json({ message: 'Not enough seeds' });
    }

    // If itemId is provided, this is a purchase request
    if (itemId) {
      // Check if item exists
      const item = await prisma.gardenItem.findUnique({
        where: { id: parseInt(itemId) }
      });
      
      if (!item) {
        return res.status(404).json({ message: 'Garden item not found' });
      }

      // Check if user already has this item
      const existingItem = await prisma.userItem.findFirst({
        where: {
          userId: req.user!.id,
          itemId: parseInt(itemId)
        }
      });
      
      if (existingItem) {
        return res.status(400).json({ message: 'You already own this item' });
      }

      // Transaction to deduct seeds and add item
      const result = await prisma.$transaction(async (tx) => {
        const updatedSeed = await tx.seed.update({
          where: { userId: req.user!.id },
          data: {
            count: {
              decrement: count
            }
          }
        });

        const userItem = await tx.userItem.create({
          data: {
            userId: req.user!.id,
            itemId: parseInt(itemId),
            equipped: false
          },
          include: {
            item: true
          }
        });

        return { updatedSeed, userItem };
      });

      
      res.json({
        seeds: result.updatedSeed,
        purchasedItem: result.userItem
      });
    } else {
      // Simple seed usage without purchase
      const updatedSeed = await prisma.seed.update({
        where: { userId: req.user!.id },
        data: {
          count: {
            decrement: count
          }
        }
      });

      res.json(updatedSeed);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error using seeds' });
  }
}; 