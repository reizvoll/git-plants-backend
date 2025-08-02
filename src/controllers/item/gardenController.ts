import prisma, { gardenItemSelect, monthlyPlantSelect } from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Request, Response } from 'express';

// GARDEN ITEMS

// Get all available garden items
export const getGardenItems = async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.gardenItem.findMany({
      select: gardenItemSelect,
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
      select: gardenItemSelect,
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
    const userCrops = await prisma.userCrop.findMany({
      where: { 
        userId: req.user!.id,
        quantity: { gt: 0 } // only crops with quantity > 0
      },
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        monthlyPlant: {
          select: {
            name: true,
            cropImageUrl: true,
            month: true,
            year: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    res.json(userCrops);
  } catch (error) {
    console.error('Error fetching user crops:', error);
    res.status(500).json({ message: 'Error fetching user crops' });
  }
};

// Sell crops for seeds
export const sellCrops = async (req: AuthRequest, res: Response) => {
  try {
    const { cropIds, totalPrice } = req.body;
    const userId = req.user!.id;
    
    if (!cropIds || !Array.isArray(cropIds) || cropIds.length === 0) {
      return res.status(400).json({ message: 'Valid crop IDs array is required' });
    }
    
    if (!totalPrice || totalPrice <= 0) {
      return res.status(400).json({ message: 'Valid total price is required' });
    }

    // Count occurrences of each UserCrop.id
    const cropCounts: { [key: string]: number } = {};
    for (const cropId of cropIds) {
      cropCounts[cropId] = (cropCounts[cropId] || 0) + 1;
    }

    // Transaction to sell crops and add seeds
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check if user has enough crops and get UserCrop records
      for (const [userCropId, requiredCount] of Object.entries(cropCounts)) {
        const userCrop = await tx.userCrop.findUnique({
          where: { id: userCropId }
        });
        
        if (!userCrop) {
          throw new Error(`Crop not found: ${userCropId}`);
        }
        
        if (userCrop.userId !== userId) {
          throw new Error(`Unauthorized crop access: ${userCropId}`);
        }
        
        if (userCrop.quantity < requiredCount) {
          throw new Error(`Not enough crops: ${userCropId}`);
        }
      }

      // 2. Decrease crop quantities
      for (const [userCropId, count] of Object.entries(cropCounts)) {
        await tx.userCrop.update({
          where: { id: userCropId },
          data: {
            quantity: { decrement: count }
          }
        });
      }

      // 3. Add seeds to user
      const updatedSeed = await tx.seed.upsert({
        where: { userId },
        update: {
          count: { increment: totalPrice }
        },
        create: {
          userId,
          count: totalPrice
        }
      });

      return { updatedSeed, soldCropsCount: cropIds.length };
    });

    res.json({
      seeds: result.updatedSeed,
      soldCropsCount: result.soldCropsCount
    });
    
  } catch (error: any) {
    console.error('Error selling crops:', error);
    
    if (error.message.includes('Not enough crops')) {
      return res.status(400).json({ message: 'Not enough crops to sell' });
    }
    
    if (error.message.includes('Crop not found')) {
      return res.status(404).json({ message: 'Crop not found' });
    }
    
    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({ message: 'Unauthorized crop access' });
    }
    
    res.status(500).json({ message: 'Error selling crops' });
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

    const changes = []; // tracking changes

    // If equipping, unequip any other items in the same category
    if (equipped) {
      // find items to unequip first
      const itemsToUnequip = await prisma.userItem.findMany({
        where: {
          userId: req.user!.id,
          item: {
            category: userItem.item.category
          },
          equipped: true,
          id: { not: req.params.id } // except current item
        },
        select: { id: true }
      });

      // add items to unequip to changes
      itemsToUnequip.forEach(item => {
        changes.push({ userItemId: item.id, equipped: false });
      });

      // actually unequip
      if (itemsToUnequip.length > 0) {
        await prisma.userItem.updateMany({
          where: {
            userId: req.user!.id,
            item: {
              category: userItem.item.category
            },
            equipped: true,
            id: { not: req.params.id }
          },
          data: { equipped: false }
        });
      }
    }

    // Update the equipped status
    await prisma.userItem.update({
      where: { id: req.params.id },
      data: { equipped }
    });

    // add current item to changes
    changes.push({ userItemId: req.params.id, equipped });

    res.json({
      changes, // only return changed items
      category: userItem.item.category
    });
  } catch (error) {
    console.error('Error updating user item:', error);
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
      select: monthlyPlantSelect,
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

// Get current active update (plant + new items)
export const getCurrentUpdate = async (req: Request, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Get current active update note
    const updateNote = await prisma.updateNote.findFirst({
      where: {
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } }
        ]
      },
      include: {
        gardenItems: {
          select: gardenItemSelect
        }
      },
      orderBy: { publishedAt: 'desc' }
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
        imageUrl: updateNote.imageUrl,
        publishedAt: updateNote.publishedAt
      } : null,
      newItems: updateNote?.gardenItems || []
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current update' });
  }
};

// Get current active update note and new items only (for shop page)
export const getCurrentUpdateNote = async (req: Request, res: Response) => {
  try {
    // Get current active update note
    const updateNote = await prisma.updateNote.findFirst({
      where: {
        isActive: true,
        OR: [
          { validUntil: null },
          { validUntil: { gte: new Date() } }
        ]
      },
      include: {
        gardenItems: {
          select: gardenItemSelect
        }
      },
      orderBy: { publishedAt: 'desc' }
    });
    
    // Prepare response (only update note and new items, no monthly plant)
    const response = {
      updateNote: updateNote ? {
        id: updateNote.id,
        title: updateNote.title,
        description: updateNote.description,
        imageUrl: updateNote.imageUrl,
        publishedAt: updateNote.publishedAt,
        validUntil: updateNote.validUntil
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
      include: {
        gardenItems: {
          select: gardenItemSelect
        }
      },
      orderBy: [
        { publishedAt: 'desc' }
      ],
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });
    
    // Format response
    const formattedUpdates = updateNotes.map((updateNote) => ({
      updateNote: {
        id: updateNote.id,
        title: updateNote.title,
        description: updateNote.description,
        imageUrl: updateNote.imageUrl,
        publishedAt: updateNote.publishedAt,
        validUntil: updateNote.validUntil,
        isActive: updateNote.isActive,
        createdAt: updateNote.createdAt
      },
      newItems: updateNote.gardenItems
    }));
    
    res.json(formattedUpdates);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update history' });
  }
}; 