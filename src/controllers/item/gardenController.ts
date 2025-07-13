import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Request, Response } from 'express';

// GARDEN ITEMS

// Get all available garden items
export const getGardenItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.gardenItem.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching garden items' });
  }
};

// Get garden item by ID
export const getGardenItemById = async (req: AuthRequest, res: Response) => {
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
};

// USER ITEMS

// Get user's items
export const getUserItems = async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    
    const userItems = await prisma.userItem.findMany({
      where: {
        userId: req.user!.id,
        ...(category && {
          item: {
            category: category as string
          }
        })
      },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' }
    });
    res.json(userItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user items' });
  }
};

// Get user's crops specifically
export const getUserCrops = async (req: AuthRequest, res: Response) => {
  try {
    const userCrops = await prisma.userItem.findMany({
      where: { 
        userId: req.user!.id,
        item: {
          category: 'crops'
        }
      },
      include: { item: true },
      orderBy: { acquiredAt: 'desc' }
    });
    
    res.json(userCrops);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user crops' });
  }
};

// Purchase item for user
export const purchaseItem = async (req: AuthRequest, res: Response) => {
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
};

// Equip/unequip user item
export const equipItem = async (req: AuthRequest, res: Response) => {
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
};

// BADGES

// Get all available badges
export const getBadges = async (req: AuthRequest, res: Response) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badges' });
  }
};

// Get user's badges
export const getUserBadges = async (req: AuthRequest, res: Response) => {
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
};

// MONTHLY PLANTS

// Get monthly plant showcase
export const getMonthlyPlants = async (req: Request, res: Response) => {
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
};

// UPDATE NOTES

// Get current month's update (plant + new items)
export const getCurrentUpdate = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Get current month's update note
    const updateNote = await prisma.updateNote.findFirst({
      where: {
        month: currentMonth,
        year: currentYear,
        isActive: true
      },
      include: {
        gardenItems: true
      }
    });
    
    // Get current month's plant
    const monthlyPlant = await prisma.monthlyPlant.findFirst({
      where: {
        month: currentMonth,
        year: currentYear
      }
    });
    
    // Prepare response
    const response = {
      month: currentMonth,
      year: currentYear,
      plant: monthlyPlant,
      updateNote: updateNote ? {
        id: updateNote.id,
        title: updateNote.title,
        description: updateNote.description,
        imageUrl: updateNote.imageUrl
      } : null,
      newItems: updateNote?.gardenItems || []
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current update' });
  }
};

// Get current month's update note and new items only (for shop page)
export const getCurrentUpdateNote = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Get current month's update note
    const updateNote = await prisma.updateNote.findFirst({
      where: {
        month: currentMonth,
        year: currentYear,
        isActive: true
      },
      include: {
        gardenItems: true
      }
    });
    
    // Prepare response (only update note and new items, no monthly plant)
    const response = {
      month: currentMonth,
      year: currentYear,
      updateNote: updateNote ? {
        id: updateNote.id,
        title: updateNote.title,
        description: updateNote.description,
        imageUrl: updateNote.imageUrl
      } : null,
      newItems: updateNote?.gardenItems || []
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current update note' });
  }
};

// Get update history
export const getUpdateHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    
    const updateNotes = await prisma.updateNote.findMany({
      where: {
        isActive: true
      },
      include: {
        gardenItems: true
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });
    
    // Format response with monthly plants and items
    const formattedUpdates = await Promise.all(
      updateNotes.map(async (updateNote) => {
        const monthlyPlant = await prisma.monthlyPlant.findFirst({
          where: {
            month: updateNote.month,
            year: updateNote.year
          }
        });
        
        return {
          month: updateNote.month,
          year: updateNote.year,
          updateNote: {
            id: updateNote.id,
            title: updateNote.title,
            description: updateNote.description,
            imageUrl: updateNote.imageUrl,
            createdAt: updateNote.createdAt
          },
          plant: monthlyPlant,
          newItems: updateNote.gardenItems
        };
      })
    );
    
    res.json(formattedUpdates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update history' });
  }
}; 