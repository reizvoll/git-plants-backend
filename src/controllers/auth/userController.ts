import prisma, { badgeSelect, gardenItemSelect, monthlyPlantSelect } from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { UserEquippedItem } from '@/types/item';
import { Response } from 'express';
import { GitHubCacheService } from '@/services/cacheService';
import { checkAndAwardBadges } from '@/services/badgeService';
import { applyTranslations, SupportedLanguage } from '@/services/translationService';

// calculate monthly contributions with Redis cache
export async function calculateMonthlyContributions(userId: string): Promise<number> {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  // check cache
  const cachedCount = await GitHubCacheService.getMonthlyContribution(
    userId, 
    currentYear, 
    currentMonth
  );
  
  if (cachedCount !== null) {
    return cachedCount;
  }
  
  // get from DB
  const contribution = await prisma.gitHubActivity.findUnique({
    where: {
      userId_month_year: {
        userId,
        month: currentMonth,
        year: currentYear
      }
    }
  });
  
  const count = contribution?.count || 0;
  
  // save to cache
  await GitHubCacheService.setMonthlyContribution(
    userId, 
    currentYear, 
    currentMonth, 
    count
  );
  
  return count;
}

// set growth stage based on contributions
function determineGrowthStage(contributions: number): 'SEED' | 'SPROUT' | 'GROWING' | 'MATURE' | 'HARVEST' {
  if (contributions >= 70) return 'HARVEST';
  if (contributions >= 50) return 'MATURE';
  if (contributions >= 30) return 'GROWING';
  if (contributions >= 10) return 'SPROUT';
  return 'SEED';
}

// check if plants need update (based on last update time)
async function shouldUpdatePlants(userId: string): Promise<boolean> {
  try {
    const lastUpdateKey = `plant_last_update:${userId}`;
    const lastUpdate = await GitHubCacheService.get(lastUpdateKey);

    if (!lastUpdate) {
      return true; // No previous update, should update
    }

    const lastUpdateTime = new Date(lastUpdate);
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);

    // Update if more than 1 hour has passed
    return hoursSinceUpdate >= 1;
  } catch (error) {
    console.error('Error checking plant update time:', error);
    return true; // On error, default to updating
  }
}

// set last update time
async function setPlantUpdateTime(userId: string): Promise<void> {
  try {
    const lastUpdateKey = `plant_last_update:${userId}`;
    await GitHubCacheService.set(lastUpdateKey, new Date().toISOString(), 3600 * 24); // Cache for 24 hours
  } catch (error) {
    console.error('Error setting plant update time:', error);
  }
}

// update all user plants automatically (with lazy update)
export async function autoUpdateAllUserPlants(userId: string) {
  try {
    // Check if update is needed
    const needsUpdate = await shouldUpdatePlants(userId);
    if (!needsUpdate) {
      // Return cached plants data
      return await getCachedPlantsData(userId);
    }

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
      
      // get initial crops
      if (targetHarvestCount > 0 && plant.harvestCount > 0) {
        const existingUserCrop = await prisma.userCrop.findUnique({
          where: {
            userId_monthlyPlantId: {
              userId,
              monthlyPlantId: plant.monthlyPlant.id
            }
          }
        });

        // give initial crops
        if (!existingUserCrop) {
          await prisma.userCrop.create({
            data: {
              userId,
              monthlyPlantId: plant.monthlyPlant.id,
              quantity: plant.harvestCount
            }
          });
        }
        // don't touch if already exists (don't restore sold crops)
      }
      
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
            stage: determineGrowthStage(currentContributions),
            harvestedAt: new Date() // record harvest time
          },
          include: { monthlyPlant: true } // uncomment
        });
        
        updatedPlants.push({
          ...updatedPlant,
          currentContributions,
          totalContributions: monthlyContributions,
          harvested: true,
          newHarvestCount: harvestsNeeded,
          receivedCrops,
          message: `Harvested ${harvestsNeeded} time(s)!`,
          currentImageUrl: getCurrentStageImageUrl(updatedPlant.monthlyPlant.imageUrls, updatedPlant.stage)
        });
      } else {
        // No harvest needed, just update stage if necessary
        const currentContributions = monthlyContributions - (targetHarvestCount * 70);
        const newStage = determineGrowthStage(currentContributions);
        
        if (newStage !== plant.stage) {
          const updatedPlant = await prisma.userPlant.update({
            where: { id: plant.id },
            data: { stage: newStage },
            include: { monthlyPlant: true }
          });
          
          updatedPlants.push({
            ...updatedPlant,
            currentContributions,
            totalContributions: monthlyContributions,
            stageUpdated: true,
            currentImageUrl: getCurrentStageImageUrl(updatedPlant.monthlyPlant.imageUrls, updatedPlant.stage)
          });
        } else {
          updatedPlants.push({
            ...plant,
            currentContributions,
            totalContributions: monthlyContributions,
            currentImageUrl: getCurrentStageImageUrl(plant.monthlyPlant.imageUrls, plant.stage)
          });
        }
      }
    }

    // Cache the updated plants data and set update time
    await cachePlantsData(userId, updatedPlants);
    await setPlantUpdateTime(userId);

    return updatedPlants;
  } catch (error) {
    console.error('Error auto-updating plants:', error);
    throw error;
  }
}

// cache plants data
async function cachePlantsData(userId: string, plantsData: any[]): Promise<void> {
  try {
    const cacheKey = `plants_data:${userId}`;
    await GitHubCacheService.set(cacheKey, JSON.stringify(plantsData), 3600 * 2); // Cache for 2 hours
  } catch (error) {
    console.error('Error caching plants data:', error);
  }
}

// get cached plants data
async function getCachedPlantsData(userId: string): Promise<any[]> {
  try {
    const cacheKey = `plants_data:${userId}`;
    const cachedData = await GitHubCacheService.get(cacheKey);

    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // If no cached data, fallback to DB query without update
    return await getPlantDataFromDB(userId);
  } catch (error) {
    console.error('Error getting cached plants data:', error);
    // Fallback to DB query
    return await getPlantDataFromDB(userId);
  }
}

// get plants data from DB without update logic
async function getPlantDataFromDB(userId: string): Promise<any[]> {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

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
        updatedAt: true,
        monthlyPlant: {
          select: monthlyPlantSelect
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get current contributions for display
    const monthlyContributions = await calculateMonthlyContributions(userId);

    return activePlants.map(plant => {
      const targetHarvestCount = Math.floor(monthlyContributions / 70);
      const currentContributions = monthlyContributions - (targetHarvestCount * 70);

      return {
        ...plant,
        currentContributions,
        totalContributions: monthlyContributions,
        currentImageUrl: getCurrentStageImageUrl(plant.monthlyPlant.imageUrls, plant.stage)
      };
    });
  } catch (error) {
    console.error('Error getting plants data from DB:', error);
    return [];
  }
}

// Simple function to add a crop to user's inventory
async function addCropToUser(plant: any, userId: string) {
  const monthlyPlant = plant.monthlyPlant;
  
  // If there is no image, don't create a crop
  if (!monthlyPlant.cropImageUrl || !monthlyPlant.iconUrl) {
    console.warn(`Skipping crop creation for ${monthlyPlant.name} - missing image URLs`);
    return null;
  }

  // increase UserCrop quantity (create if not exists)
  const userCrop = await prisma.userCrop.upsert({
    where: {
      userId_monthlyPlantId: {
        userId,
        monthlyPlantId: monthlyPlant.id
      }
    },
    update: {
      quantity: { increment: 1 }
    },
    create: {
      userId,
      monthlyPlantId: monthlyPlant.id,
      quantity: 1
    },
    include: { 
      monthlyPlant: {
        select: {
          id: true,
          name: true,
          cropImageUrl: true,
          iconUrl: true
        }
      }
    }
  });
  
  return userCrop;
}

// Helper function to get current stage image URL
function getCurrentStageImageUrl(imageUrls: string[], stage: string): string {
  const stageIndex = ['SEED', 'SPROUT', 'GROWING', 'MATURE'].indexOf(stage);
  return imageUrls[stageIndex] || imageUrls[0];
}

// ===== API Endpoints =====

// Get user profile with all related information (including plants with GitHub contributions)
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const locale = (req.query.locale as SupportedLanguage) || 'en';
    const userId = req.user!.id;
    const isAdmin = req.isAdmin;

    // Get basic user information first (crops 제외)
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

    // Update plants first
    const plantsWithContributions = await autoUpdateAllUserPlants(userId);

    // Check and award badges
    const newBadges = await checkAndAwardBadges(userId);

    // get crops
    const userCrops = await prisma.userCrop.findMany({
      where: { userId },
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

    // Apply translations to monthly plant names in crops
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

    // Apply translations to badges
    const translatedUserBadges = await Promise.all(
      userBadges.map(async (userBadge) => {
        const [translatedBadge] = await applyTranslations(
          [userBadge.badge],
          'Badge',
          locale,
          ['name']
        );
        return {
          ...userBadge,
          badge: translatedBadge
        };
      })
    );
    
    // Apply translations to all items
    const translatedAllItems = await Promise.all(
      allUserItems.map(async (userItem) => {
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
    
    // Apply translations to equipped items
    const translatedEquippedItems = await Promise.all(
      equippedItems.map(async (userItem) => {
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

    // Separate equipped items by category
    const equippedBackgrounds = translatedEquippedItems.filter((item: UserEquippedItem) => 
      item.item.category === 'background' &&
      item.item.mode // 모드 조건 추가 (default 포함 - 공용 모드로 설정)
    ).map((item: UserEquippedItem) => item.item);
    
    const equippedPots = translatedEquippedItems.filter((item: UserEquippedItem) => 
      item.item.category === 'pot'
    ).map((item: UserEquippedItem) => item.item);

    res.json({
      user: {
        ...userInfo,
        isAdmin
      },
      seedCount: userSeed?.count || 0,
      badges: translatedUserBadges,
      items: translatedAllItems, // 모든 아이템들
      equipped: {
        backgrounds: equippedBackgrounds,
        pots: equippedPots
      },
      plants: plantsWithContributions,
      crops: translatedUserCrops,
      newBadges
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
    const locale = (req.query.locale as SupportedLanguage) || 'en';
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

    // Apply translations to monthly plant
    const [translatedPlant] = await applyTranslations(
      [monthlyPlant],
      'MonthlyPlant',
      locale,
      ['title', 'description', 'name']
    );

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
      monthlyPlant: translatedPlant,
      userPlants: existingUserPlants,
      totalPlanted: existingUserPlants.length,
      canPlantMore: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current month plant' });
  }
};

// Public API - Get user profile for public access
export const getPublicUserProfile = async (req: any, res: Response) => {
  try {
    const { username } = req.params;
    const locale = (req.query.locale as SupportedLanguage) || 'en';

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }

    // Check if user exists and get userId
    const user = await prisma.user.findFirst({
      where: { username },
      select: { id: true, username: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userId = user.id;

    // Get user's equipped items
    const equippedItems = await prisma.userItem.findMany({
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
    });

    // Get user's plants with same auto-update logic as private API
    const plantsWithContributions = await autoUpdateAllUserPlants(userId);

    // Apply translations to equipped items
    const translatedEquippedItems = await Promise.all(
      equippedItems.map(async (userItem) => {
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

    // Separate equipped items by category
    const equippedBackgrounds = translatedEquippedItems.filter((item: UserEquippedItem) =>
      item.item.category === 'background' &&
      item.item.mode
    ).map((item: UserEquippedItem) => item.item);

    const equippedPots = translatedEquippedItems.filter((item: UserEquippedItem) =>
      item.item.category === 'pot'
    ).map((item: UserEquippedItem) => item.item);

    res.json({
      equipped: {
        backgrounds: equippedBackgrounds,
        pots: equippedPots
      },
      plants: plantsWithContributions
    });
  } catch (error) {
    console.error('Error fetching public user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
}; 