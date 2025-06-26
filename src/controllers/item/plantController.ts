import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// Get all user's plants
export const getPlants = async (req: AuthRequest, res: Response) => {
  try {
    const plants = await prisma.plant.findMany({
      where: { userId: req.user!.id },
      include: { growthLogs: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(plants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plants' });
  }
};

// Get plant by ID
export const getPlantById = async (req: AuthRequest, res: Response) => {
  try {
    const plant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      },
      include: { growthLogs: true }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    res.json(plant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching plant' });
  }
};

// Create a new plant
export const createPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Plant name is required' });
    }
    
    const plant = await prisma.plant.create({
      data: {
        name,
        userId: req.user!.id,
        imageUrl: '',
        stage: 'SEED',
        currentContributions: 0
      }
    });
    
    res.status(201).json(plant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating plant' });
  }
};

// Update plant
export const updatePlant = async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body;
    
    // Check if plant exists and belongs to user
    const existingPlant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!existingPlant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const updatedPlant = await prisma.plant.update({
      where: { id: req.params.id },
      data: { name }
    });
    
    res.json(updatedPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating plant' });
  }
};

// Delete plant
export const deletePlant = async (req: AuthRequest, res: Response) => {
  try {
    // Check if plant exists and belongs to user
    const plant = await prisma.plant.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id
      }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    await prisma.plant.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting plant' });
  }
};

// Add growth log to a plant
export const addGrowthLog = async (req: AuthRequest, res: Response) => {
  try {
    const { log, count } = req.body;
    const { plantId } = req.params;
    
    // Check if plant exists and belongs to user
    const plant = await prisma.plant.findUnique({
      where: {
        id: plantId,
        userId: req.user!.id
      }
    });
    
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }
    
    const growthLog = await prisma.growthLog.create({
      data: {
        plantId,
        log,
        count
      }
    });
    
    // Update plant's currentContributions
    await prisma.plant.update({
      where: { id: plantId },
      data: { 
        currentContributions: plant.currentContributions + count,
        // Update stage based on new contribution count if needed
        stage: determineGrowthStage(plant.currentContributions + count)
      }
    });
    
    res.status(201).json(growthLog);
  } catch (error) {
    res.status(500).json({ message: 'Error creating growth log' });
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