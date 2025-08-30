import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';
import { calculateMonthlyContributions, autoUpdateAllUserPlants } from '@/controllers/auth/userController';
import { checkAndAwardBadges } from '@/services/badgeService';

// Handle plant harvest - create crop item and reset plant
async function handleHarvest(userPlant: any, userId: string) {
  const monthlyPlant = userPlant.monthlyPlant;
  
  // Check if crop item already exists for this monthly plant
  let cropItem = await prisma.gardenItem.findFirst({
    where: {
      name: `${monthlyPlant.name}`,
      category: 'crops'
    }
  });
  
  // If crop item doesn't exist, create it
  if (!cropItem) {
    cropItem = await prisma.gardenItem.create({
      data: {
        name: `${monthlyPlant.name}`,
        category: 'crops',
        imageUrl: monthlyPlant.cropImageUrl, // Use cropImageUrl instead of imageUrls[4]
        iconUrl: monthlyPlant.iconUrl || monthlyPlant.cropImageUrl,
        price: 0, // Free since it's earned through harvest
        updatedById: null
      }
    });
  }
  
  // Add crop to user's items
  const userCrop = await prisma.userItem.create({
    data: {
      userId,
      itemId: cropItem.id
    },
    include: {
      item: true
    }
  });
  
  // Harvest achieved - reset to SEED stage and increment harvest count
  const updatedPlant = await prisma.userPlant.update({
    where: { id: userPlant.id },
    data: { 
      stage: 'SEED', // Reset to SEED stage
      harvestCount: userPlant.harvestCount + 1 // Increment harvest count
    }
  });

  // Check for badges after harvest
  const newBadges = await checkAndAwardBadges(userId);
  
  return {
    ...updatedPlant,
    harvested: true,
    newHarvestCount: updatedPlant.harvestCount,
    resetToSeed: true,
    cropReceived: userCrop,
    newBadges,
    message: `Congratulations! Your ${monthlyPlant.name} has been harvested and you received a crop!`
  };
}

// Get all user's plants with GitHub-based contributions
export const getPlants = async (req: AuthRequest, res: Response) => {
  try {
    // 통합된 식물 업데이트 함수 사용
    const plantsWithContributions = await autoUpdateAllUserPlants(req.user!.id);
    res.json(plantsWithContributions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plants' });
  }
};

// Get plant by ID with GitHub-based contributions
export const getPlantById = async (req: AuthRequest, res: Response) => {
  try {
    const userPlant = await prisma.userPlant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: { 
        monthlyPlant: true
      }
    });
    
    if (!userPlant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    // 통합된 식물 업데이트 시스템 사용
    const allPlants = await autoUpdateAllUserPlants(req.user!.id);
    const targetPlant = allPlants.find(plant => plant.id === req.params.id);
    
    if (!targetPlant) {
      return res.status(404).json({ message: 'Plant not found after update' });
    }
    
    res.json(targetPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plant' });
  }
};

// Create a new plant (based on current month's MonthlyPlant)
export const createPlant = async (req: AuthRequest, res: Response) => {
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
    
    // Check if user already has a plant for this month/year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Only allow planting current month's plant
    if (monthlyPlant.month !== currentMonth || monthlyPlant.year !== currentYear) {
      return res.status(400).json({ message: 'You can only plant the current month\'s plant' });
    }
    
    const userPlant = await prisma.userPlant.create({
      data: {
        userId: req.user!.id,
        monthlyPlantId: parseInt(monthlyPlantId),
        stage: 'SEED'
      },
      include: {
        monthlyPlant: true
      }
    });

    // Check for badges after creating plant
    const newBadges = await checkAndAwardBadges(req.user!.id);
    
    res.status(201).json({
      ...userPlant,
      newBadges
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating plant' });
  }
};

// Update plant - only stage can be manually updated now
export const updatePlant = async (req: AuthRequest, res: Response) => {
  try {
    const { stage } = req.body;
    
    // Check if plant exists and belongs to user
    const existingPlant = await prisma.userPlant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!existingPlant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const updatedPlant = await prisma.userPlant.update({
      where: { id: req.params.id },
      data: { 
        ...(stage && { stage })
      },
      include: {
        monthlyPlant: true
      }
    });
    
    // Calculate contributions for response using unified function
    const contributions = await calculateMonthlyContributions(req.user!.id);
    
    res.json({
      ...updatedPlant,
      contributions
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating plant' });
  }
};

// Delete plant
export const deletePlant = async (req: AuthRequest, res: Response) => {
  try {
    // Check if plant exists and belongs to user
    const plant = await prisma.userPlant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    await prisma.userPlant.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting plant' });
  }
};

// Auto-update plant growth based on GitHub activities
export const updatePlantGrowth = async (req: AuthRequest, res: Response) => {
  try {
    const { userPlantId } = req.params;
    
    // Check if plant exists and belongs to user
    const userPlant = await prisma.userPlant.findUnique({
      where: {
        id: userPlantId,
        userId: req.user!.id
      },
      include: {
        monthlyPlant: true
      }
    });
    
    if (!userPlant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    // 통합된 업데이트 시스템 사용
    const allPlants = await autoUpdateAllUserPlants(req.user!.id);
    const targetPlant = allPlants.find(plant => plant.id === userPlantId);
    
    if (!targetPlant) {
      return res.status(404).json({ message: 'Plant not found after update' });
    }
    
    res.json(targetPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating plant growth' });
  }
};

// Get current month's available plant
export const getCurrentMonthPlant = async (req: AuthRequest, res: Response) => {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    const monthlyPlant = await prisma.monthlyPlant.findFirst({
      where: {
        month: currentMonth,
        year: currentYear
      }
    });
    
    if (!monthlyPlant) {
      return res.status(404).json({ message: 'No plant available for current month' });
    }
    
    // Check if user has any plants for this month
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
      canPlantMore: true // 수확 후 재심기 가능
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching current month plant' });
  }
};

// Helper function to determine growth stage
function determineGrowthStage(contributions: number): 'SEED' | 'SPROUT' | 'GROWING' | 'MATURE' | 'HARVEST' {
  if (contributions >= 70) return 'HARVEST';
  if (contributions >= 50) return 'MATURE';
  if (contributions >= 30) return 'GROWING';
  if (contributions >= 10) return 'SPROUT';
  return 'SEED';
}

// Helper function to get current stage image URL
function getCurrentStageImageUrl(imageUrls: string[], stage: string): string {
  const stageIndex = ['SEED', 'SPROUT', 'GROWING', 'MATURE'].indexOf(stage);
  return imageUrls[stageIndex] || imageUrls[0];
} 