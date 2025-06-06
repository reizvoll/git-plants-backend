import prisma from '@/config/db';
import { clientAuth } from '@/middlewares/authMiddleware';
import { AuthRequest } from '@/types/auth';
import express, { Request, Response } from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// GARDEN ITEMS

// Get all available garden items
router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.gardenItem.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching garden items' });
  }
});

// Get garden item by ID
router.get('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const item = await prisma.gardenItem.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    
    if (!item) {
      return res.status(404).json({ message: 'Garden item not found' });
    }
    
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching garden item' });
  }
});

// USER ITEMS

// Get user's items
router.get('/user-items', async (req: AuthRequest, res: Response) => {
  try {
    const userItems = await prisma.userItem.findMany({
      where: { userId: req.user!.id },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' }
    });
    res.json(userItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user items' });
  }
});

// Purchase item for user
router.post('/user-items', async (req: AuthRequest, res: Response) => {
  try {
    const { itemId } = req.body;
    
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
    
    // Add item to user's inventory
    const userItem = await prisma.userItem.create({
      data: {
        userId: req.user!.id,
        itemId: parseInt(itemId),
        equipped: false
      }
    });
    
    res.status(201).json(userItem);
  } catch (error) {
    res.status(500).json({ message: 'Error purchasing item' });
  }
});

// Equip/unequip user item
router.put('/user-items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { equipped } = req.body;
    
    // Check if userItem exists and belongs to user
    const userItem = await prisma.userItem.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: { item: true }
    });
    
    if (!userItem) {
      return res.status(404).json({ message: 'User item not found' });
    }
    
    // If equipping, unequip any other items in the same category
    if (equipped) {
      await prisma.userItem.updateMany({
        where: {
          userId: req.user!.id,
          item: {
            category: userItem.item.category
          },
          equipped: true
        },
        data: { equipped: false }
      });
    }
    
    // Update the equipped status
    const updatedUserItem = await prisma.userItem.update({
      where: { id: req.params.id },
      data: { equipped },
      include: { item: true }
    });
    
    res.json(updatedUserItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating user item' });
  }
});

// BADGES

// Get all available badges
router.get('/badges', async (req: AuthRequest, res: Response) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badges' });
  }
});

// Get user's badges
router.get('/user-badges', async (req: AuthRequest, res: Response) => {
  try {
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' }
    });
    res.json(userBadges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user badges' });
  }
});

// MONTHLY PLANTS

// Get monthly plant showcase
router.get('/monthly-plants', async (req: Request, res: Response) => {
  try {
    const { month, year } = req.query;
    
    let whereClause = {};
    
    if (month && year) {
      whereClause = {
        month: parseInt(month as string),
        year: parseInt(year as string)
      };
    } else {
      // Default to current month if not specified
      const currentDate = new Date();
      whereClause = {
        month: currentDate.getMonth() + 1, // 1-12 for months
        year: currentDate.getFullYear()
      };
    }
    
    const monthlyPlant = await prisma.monthlyPlant.findFirst({
      where: whereClause
    });
    
    if (!monthlyPlant) {
      return res.status(404).json({ message: 'Monthly plant not found' });
    }
    
    res.json(monthlyPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly plant' });
  }
});

export default router; 