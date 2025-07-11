import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

export const getMonthlyPlants = async (req: AuthRequest, res: Response) => {
  try {
    const monthlyPlants = await prisma.monthlyPlant.findMany({
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.json(monthlyPlants);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly plants' });
  }
};

export const getMonthlyPlantById = async (req: AuthRequest, res: Response) => {
  try {
    const monthlyPlant = await prisma.monthlyPlant.findUnique({
      where: { id: parseInt(req.params.id) }
    });
    
    if (!monthlyPlant) {
      return res.status(404).json({ message: 'Monthly plant not found' });
    }
    
    res.json(monthlyPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly plant' });
  }
};

export const createMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { title, name, description, imageUrls, iconUrl, month, year } = req.body;
    
    if (!title || !name || !description || !imageUrls || !month || !year) {
      return res.status(400).json({ message: 'Title, name, description, imageUrls, month, and year are required' });
    }
    
    // Validate imageUrls array (should have 5 images for all growth stages)
    if (!Array.isArray(imageUrls) || imageUrls.length !== 5) {
      return res.status(400).json({ 
        message: 'imageUrls array with exactly 5 images is required (SEED, SPROUT, GROWING, MATURE, HARVEST)' 
      });
    }
    
    // SuperUser validation is already done in adminAuth middleware
    
    const existingPlant = await prisma.monthlyPlant.findFirst({
      where: {
        month: parseInt(month),
        year: parseInt(year)
      }
    });
    
    if (existingPlant) {
      return res.status(409).json({ message: 'A monthly plant already exists for this month and year' });
    }
    
    const monthlyPlant = await prisma.monthlyPlant.create({
      data: {
        title,
        name,
        description,
        imageUrls,
        iconUrl,
        month: parseInt(month),
        year: parseInt(year),
        updatedById: req.superUser!.id
      }
    });
    
    res.status(201).json(monthlyPlant);
  } catch (error) {
    console.error('Monthly plant creation error:', error);
    res.status(500).json({ message: 'Error creating monthly plant' });
  }
};

export const updateMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { title, name, description, imageUrls, iconUrl } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Build update data object with only provided fields
    const updateData: any = {
      updatedById: req.superUser!.id
    };
    
    if (title) updateData.title = title;
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (iconUrl) updateData.iconUrl = iconUrl;
    if (imageUrls) {
      if (!Array.isArray(imageUrls) || imageUrls.length !== 5) {
        return res.status(400).json({ 
          message: 'imageUrls array with exactly 5 images is required (SEED, SPROUT, GROWING, MATURE, HARVEST)' 
        });
      }
      updateData.imageUrls = imageUrls;
    }
    
    const updatedPlant = await prisma.monthlyPlant.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });
    
    res.json(updatedPlant);
  } catch (error) {
    console.error('Monthly plant update error:', error);
    res.status(500).json({ message: 'Error updating monthly plant' });
  }
};

export const deleteMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.monthlyPlant.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.status(200).json({ message: 'Monthly plant deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting monthly plant' });
  }
};