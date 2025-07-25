import prisma, { badgeSelect, gardenItemSelect, monthlyPlantSelect } from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// calculate monthly contributions
export async function calculateMonthlyContributions(userId: string): Promise<number> {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // from the first day of the month to the last day of the month
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);
  
  const contributions = await prisma.gitHubActivity.aggregate({
    where: {
      userId,
      date: { 
        gte: monthStart,
        lte: monthEnd
      }
    },
    _sum: { count: true }
  });
  
  return contributions._sum.count || 0;
}

// set growth stage based on contributions
function determineGrowthStage(contributions: number): 'SEED' | 'SPROUT' | 'GROWING' | 'MATURE' | 'HARVEST' {
  if (contributions >= 70) return 'HARVEST';
  if (contributions >= 50) return 'MATURE';
  if (contributions >= 30) return 'GROWING';
  if (contributions >= 10) return 'SPROUT';
  return 'SEED';
}

// update all user plants automatically
export async function autoUpdateAllUserPlants(userId: string) {
  try {
    const monthlyContributions = await calculateMonthlyContributions(userId);
    
    // Get current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Only get current month's plants
    const activePlants = await prisma.userPlant.findMany({
      where: { 
        userId,
        monthlyPlant: {
          month: currentMonth,
          year: currentYear
        }
      },
      select: {
        id: true,
        stage: true,
        harvestCount: true,
        monthlyPlant: {
          select: monthlyPlantSelect
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const updatedPlants = [];

    for (const plant of activePlants) {
      // How many times should this plant be harvested?
      const targetHarvestCount = Math.floor(monthlyContributions / 70);
      
      // Process harvests if needed
      if (targetHarvestCount > plant.harvestCount) {
        const harvestsNeeded = targetHarvestCount - plant.harvestCount;
        const receivedCrops = [];
        
        // Add crops for each harvest
        for (let i = 0; i < harvestsNeeded; i++) {
          const crop = await addCropToUser(plant, userId);
          receivedCrops.push(crop);
        }
        
        // Calculate current contributions after harvest
        const currentContributions = monthlyContributions - (targetHarvestCount * 70);
        
        // Update plant with new harvest count and stage
        const updatedPlant = await prisma.userPlant.update({
          where: { id: plant.id },
          data: { 
            harvestCount: targetHarvestCount,
            stage: determineGrowthStage(currentContributions)
          },
          // include: { monthlyPlant: true }
        });
        
        updatedPlants.push({
          ...updatedPlant,
          currentContributions,
          totalContributions: monthlyContributions,
          harvested: true,
          newHarvestCount: harvestsNeeded,
          receivedCrops,
          message: `Harvested ${harvestsNeeded} time(s)!`,
          // currentImageUrl: getCurrentStageImageUrl(updatedPlant.monthlyPlant.imageUrls, updatedPlant.stage)
        });
      } else {
        // No harvest needed, just update stage if necessary
        const currentContributions = monthlyContributions - (targetHarvestCount * 70);
        const newStage = determineGrowthStage(currentContributions);
        
        if (newStage !== plant.stage) {
          const updatedPlant = await prisma.userPlant.update({
            where: { id: plant.id },
            data: { stage: newStage },
            // include: { monthlyPlant: true }
          });
          
          updatedPlants.push({
            ...updatedPlant,
            currentContributions,
            totalContributions: monthlyContributions,
            stageUpdated: true,
            // currentImageUrl: getCurrentStageImageUrl(updatedPlant.monthlyPlant.imageUrls, newStage)
          });
        } else {
          // No changes needed
          updatedPlants.push({
            ...plant,
            currentContributions,
            totalContributions: monthlyContributions,
            currentImageUrl: getCurrentStageImageUrl(plant.monthlyPlant.imageUrls, plant.stage)
          });
        }
      }
    }
    
    return updatedPlants;
  } catch (error) {
    console.error('Error auto-updating plants:', error);
    throw error;
  }
}

// Simple function to add a crop to user's inventory
async function addCropToUser(plant: any, userId: string) {
  const monthlyPlant = plant.monthlyPlant;
  
  // Find or create crop item
  let cropItem = await prisma.gardenItem.findFirst({
    where: { name: monthlyPlant.name, category: 'crops' }
  });
  
  if (!cropItem) {
    cropItem = await prisma.gardenItem.create({
      data: {
        name: monthlyPlant.name,
        category: 'crops',
        imageUrl: monthlyPlant.imageUrls[4],
        iconUrl: monthlyPlant.iconUrl || monthlyPlant.imageUrls[4],
        price: 0,
        updatedById: null
      }
    });
  }
  
  // Add to user's inventory
  return await prisma.userItem.create({
    data: { userId, itemId: cropItem.id, equipped: false },
    include: { item: true }
  });
}

// Helper function to get current stage image URL
function getCurrentStageImageUrl(imageUrls: string[], stage: string): string {
  const stageIndex = ['SEED', 'SPROUT', 'GROWING', 'MATURE', 'HARVEST'].indexOf(stage);
  return imageUrls[stageIndex] || imageUrls[0];
}

// ===== API Endpoints =====

// Get user profile with all related information (including plants with GitHub contributions)
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.isAdmin;

    // Get all user information in parallel
    const [userInfo, userSeed, userBadges, allUserItems, equippedItems] = await Promise.all([
      // Basic user info
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          username: true,
          image: true,
        },
      }),
      // User's seed count
      prisma.seed.findUnique({
        where: { userId },
        select: { count: true }
      }),
      // User's badges
      prisma.userBadge.findMany({
        where: { userId },
        select: {
          id: true,
          awardedAt: true,
          badge: {
            select: badgeSelect
          }
        },
        orderBy: { awardedAt: 'desc' }
      }),
      // All user items
      prisma.userItem.findMany({
        where: { userId },
        select: {
          id: true,
          equipped: true,
          acquiredAt: true,
          item: {
            select: gardenItemSelect
          }
        },
        orderBy: { acquiredAt: 'desc' }
      }),
      // User's equipped items only
      prisma.userItem.findMany({
        where: { 
          userId,
          equipped: true
        },
        select: {
          id: true,
          equipped: true,
          acquiredAt: true,
          item: {
            select: gardenItemSelect
          }
        }
      })
    ]);

    if (!userInfo) {
      return res.status(404).json({ message: 'User not found' });
    }

    // use autoUpdateAllUserPlants function
    const plantsWithContributions = await autoUpdateAllUserPlants(userId);

    // Separate equipped items by category
    const equippedBackgrounds = equippedItems.filter(item => 
      item.item.category === 'background' &&
      item.item.mode // 모드 조건 추가 (default 포함 - 공용 모드로 설정)
    ).map(item => item.item);
    
    const equippedPots = equippedItems.filter(item => 
      item.item.category === 'pot'
    ).map(item => item.item);

    res.json({
      user: {
        ...userInfo,
        isAdmin
      },
      seedCount: userSeed?.count || 0,
      badges: userBadges,
      items: allUserItems, // 모든 아이템들
      equipped: {
        backgrounds: equippedBackgrounds,
        pots: equippedPots
      },
      plants: plantsWithContributions
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
};

// Create a new plant for current user
export const createUserPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { monthlyPlantId } = req.body;
    
    if (!monthlyPlantId) {
      return res.status(400).json({ message: 'Monthly plant ID is required' });
    }
    
    // Check if monthly plant exists
    const monthlyPlant = await prisma.monthlyPlant.findUnique({
      where: { id: parseInt(monthlyPlantId) }
    });
    
    if (!monthlyPlant) {
      return res.status(404).json({ message: 'Monthly plant not found' });
    }
    
    // Check if it's current month's plant
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    if (monthlyPlant.month !== currentMonth || monthlyPlant.year !== currentYear) {
      return res.status(400).json({ message: 'You can only plant the current month\'s plant' });
    }
    
    const userPlant = await prisma.userPlant.create({
      data: {
        userId: req.user!.id,
        monthlyPlantId: parseInt(monthlyPlantId),
        stage: 'SEED'
      },
      select: {
        id: true,
        stage: true,
        harvestCount: true,
        monthlyPlant: {
          select: monthlyPlantSelect
        }
      }
    });
    
    res.status(201).json(userPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating plant' });
  }
};

// Get current month's available plant info
export const getCurrentMonthPlant = async (req: AuthRequest, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const monthlyPlant = await prisma.monthlyPlant.findFirst({
      select: monthlyPlantSelect,
      where: {
        month: currentMonth,
        year: currentYear
      }
    });
    
    if (!monthlyPlant) {
      return res.status(404).json({ message: 'No plant available for current month' });
    }
    
    // Check user's plants for this month
    const existingUserPlants = await prisma.userPlant.findMany({
      where: {
        userId: req.user!.id,
        monthlyPlantId: monthlyPlant.id
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    res.json({
      monthlyPlant,
      userPlants: existingUserPlants,
      totalPlanted: existingUserPlants.length,
      canPlantMore: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current month plant' });
  }
}; 