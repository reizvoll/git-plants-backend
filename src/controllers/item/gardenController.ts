import prisma, { gardenItemSelect, monthlyPlantSelect, PrismaTransaction } from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Request, Response } from 'express';
import { UpdateNoteService } from '@/services/updateNoteService';
import { checkAndAwardBadges } from '@/services/badgeService';
import { applyTranslations, SupportedLanguage } from '@/services/translationService';
import { invalidatePlantsCache } from '@/controllers/auth/userController';

// GARDEN ITEMS

// Get all available garden items
export const getGardenItems = async (req: AuthRequest, res: Response) => {
  try {
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    
    const items = await prisma.gardenItem.findMany({
      where: {
        isAvailable: true
      },
      select: gardenItemSelect,
      orderBy: { category: 'asc' }
    });
    
    const translatedItems = await applyTranslations(
      items,
      'GardenItem',
      locale,
      ['name']
    );
    
    res.json(translatedItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching garden items' });
  }
};

// Get garden item by ID
export const getGardenItemById = async (req: AuthRequest, res: Response) => {
  try {
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    
    const item = await prisma.gardenItem.findUnique({
      select: gardenItemSelect,
      where: { 
        id: parseInt(req.params.id),
        isAvailable: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ message: 'Garden item not found' });
    }
    
    const [translatedItem] = await applyTranslations(
      [item],
      'GardenItem',
      locale,
      ['name']
    );
    
    res.json(translatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching garden item' });
  }
};

// USER ITEMS

// Get user's items
export const getUserItems = async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    const locale = (req.query.locale as SupportedLanguage) || 'en';

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

    // Apply translations to items
    const translatedUserItems = await Promise.all(
      userItems.map(async (userItem) => {
        const [translatedItem] = await applyTranslations(
          [userItem.item],
          'GardenItem',
          locale,
          ['name']
        );
        return {
          ...userItem,
          item: translatedItem
        };
      })
    );

    res.json(translatedUserItems);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user items' });
  }
};

// Get user's crops specifically
export const getUserCrops = async (req: AuthRequest, res: Response) => {
  try {
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    
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
            id: true,
            name: true,
            cropImageUrl: true,
            month: true,
            year: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    // Apply translations to monthlyPlant names
    const translatedUserCrops = await Promise.all(
      userCrops.map(async (userCrop) => {
        if (userCrop.monthlyPlant) {
          const [translatedPlant] = await applyTranslations(
            [userCrop.monthlyPlant],
            'MonthlyPlant',
            locale,
            ['name']
          );
          return {
            ...userCrop,
            monthlyPlant: translatedPlant
          };
        }
        return userCrop;
      })
    );
    
    res.json(translatedUserCrops);
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
    const result = await prisma.$transaction(async (tx: PrismaTransaction) => {
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

    // Check for badges after selling crops
    const newBadges = await checkAndAwardBadges(req.user!.id);

    // Invalidate cache to reflect sold crops immediately
    await invalidatePlantsCache(userId);

    res.json({
      seeds: result.updatedSeed,
      soldCropsCount: result.soldCropsCount,
      newBadges
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
    
    // Check if item exists and is available
    const item = await prisma.gardenItem.findUnique({
      where: { 
        id: parseInt(itemId),
        isAvailable: true
      }
    });
    
    if (!item) {
      return res.status(404).json({ message: 'Garden item not found or not available' });
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
      itemsToUnequip.forEach((item: { id: string }) => {
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
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    
    const badges = await prisma.badge.findMany();
    
    const translatedBadges = await applyTranslations(
      badges,
      'Badge',
      locale,
      ['name', 'condition']
    );
    
    res.json(translatedBadges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badges' });
  }
};

// Get user's badges
export const getUserBadges = async (req: AuthRequest, res: Response) => {
  try {
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    
    const userBadges = await prisma.userBadge.findMany({
      where: { userId: req.user!.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' }
    });
    
    // Apply translations to badge names
    const translatedUserBadges = await Promise.all(
      userBadges.map(async (userBadge) => {
        const [translatedBadge] = await applyTranslations(
          [userBadge.badge],
          'Badge',
          locale,
          ['name', 'condition']
        );
        return {
          ...userBadge,
          badge: translatedBadge
        };
      })
    );
    
    res.json(translatedUserBadges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user badges' });
  }
};

// MONTHLY PLANTS

// Get monthly plant showcase
export const getMonthlyPlants = async (req: Request, res: Response) => {
  try {
    const { month, year, locale } = req.query;
    const requestedLocale = (locale as SupportedLanguage) || 'en';
    
    if (month && year) {
      const monthlyPlant = await prisma.monthlyPlant.findFirst({
        select: monthlyPlantSelect,
        where: {
          month: parseInt(month as string),
          year: parseInt(year as string)
        }
      });
      
      if (!monthlyPlant) {
        return res.status(404).json({ message: 'Monthly plant not found' });
      }
      
      const [translatedPlant] = await applyTranslations(
        [monthlyPlant],
        'MonthlyPlant',
        requestedLocale,
        ['title', 'description', 'name']
      );
      
      res.json(translatedPlant);
    } else {
      // Default to current month if not specified
      const currentDate = new Date();
      const monthlyPlant = await prisma.monthlyPlant.findFirst({
        select: monthlyPlantSelect,
        where: {
          month: currentDate.getMonth() + 1, // 1-12 for months
          year: currentDate.getFullYear()
        }
      });
      
      if (!monthlyPlant) {
        return res.status(404).json({ message: 'Monthly plant not found' });
      }
      
      const [translatedPlant] = await applyTranslations(
        [monthlyPlant],
        'MonthlyPlant',
        requestedLocale,
        ['title', 'description', 'name']
      );
      
      res.json(translatedPlant);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly plant' });
  }
};

// UPDATE NOTES

    // Get current active update note and new items only (for shop page)
export const getCurrentUpdateNote = async (req: Request, res: Response) => {
  try {
    const { locale } = req.query;
    const requestedLocale = (locale as SupportedLanguage) || 'en';
    const now = new Date();
    
    // update isActive status automatically based on time
    await UpdateNoteService.updateActiveStatus();
    
    // Get current active update note with publishedAt filter
    const updateNote = await prisma.updateNote.findFirst({
      where: {
        isActive: true,
        publishedAt: { lte: now },
        OR: [
          { validUntil: null },
          { validUntil: { gte: now } }
        ]
      },
      include: {
        gardenItems: {
          where: {
            isAvailable: true
          },
          select: gardenItemSelect
        }
      },
      orderBy: { publishedAt: 'desc' }
    });
    
    if (updateNote) {
      // Apply translations to update note
      const [translatedNote] = await applyTranslations(
        [updateNote],
        'UpdateNote',
        requestedLocale,
        ['title', 'description']
      );

      // Apply translations to garden items
      const translatedItems = await applyTranslations(
        updateNote.gardenItems,
        'GardenItem',
        requestedLocale,
        ['name']
      );

      // Select image based on locale from imageUrls array
      // imageUrls: [englishUrl, koreanUrl]
      const imageUrl = requestedLocale === 'ko' && updateNote.imageUrls.length > 1
        ? updateNote.imageUrls[1]
        : updateNote.imageUrls[0];

      // Remove imageUrls array and use single imageUrl for client
      const { imageUrls: _, ...noteWithoutImageUrls } = translatedNote;

      // Prepare response (only update note and new items, no monthly plant)
      const response = {
        updateNote: {
          ...noteWithoutImageUrls,
          imageUrl, // single imageUrl based on locale
          gardenItems: translatedItems
        },
        newItems: translatedItems
      };

      res.json(response);
    } else {
      res.json({
        updateNote: null,
        newItems: []
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current update note' });
  }
};
