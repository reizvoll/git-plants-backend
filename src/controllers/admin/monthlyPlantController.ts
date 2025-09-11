import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';
import { upsertTranslation, getTranslationsForEntity } from '@/services/translationService';

export const getMonthlyPlants = async (req: AuthRequest, res: Response) => {
  try {
    const monthlyPlants = await prisma.monthlyPlant.findMany({
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    
    // Add translation data for admin
    const plantsWithTranslations = await Promise.all(
      monthlyPlants.map(async (plant) => {
        const translations = await getTranslationsForEntity('MonthlyPlant', plant.id.toString());
        return {
          ...plant,
          ...translations
        };
      })
    );
    
    res.json(plantsWithTranslations);
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
    
    // Add translation data for admin
    const translations = await getTranslationsForEntity('MonthlyPlant', monthlyPlant.id.toString());
    const plantWithTranslations = {
      ...monthlyPlant,
      ...translations
    };
    
    res.json(plantWithTranslations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching monthly plant' });
  }
};

export const createMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      title, titleKo, 
      name, nameKo, 
      description, descriptionKo, 
      mainImageUrl, imageUrls, iconUrl, cropImageUrl, month, year 
    } = req.body;
    
    if (!title || !name || !description || !mainImageUrl || !imageUrls || !month || !year) {
      return res.status(400).json({ message: 'Title, name, description, mainImageUrl, imageUrls, month, and year are required' });
    }
    
    // Validate imageUrls array (should have 4 images for growth stages: SEED, SPROUT, GROWING, MATURE)
    if (!Array.isArray(imageUrls) || imageUrls.length !== 4) {
      return res.status(400).json({ 
        message: 'imageUrls array with exactly 4 images is required (SEED, SPROUT, GROWING, MATURE)' 
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
        title, // default (english)
        name,  // default (english)  
        description, // default (english)
        mainImageUrl,
        imageUrls,
        iconUrl,
        cropImageUrl,
        month: parseInt(month),
        year: parseInt(year),
        updatedById: req.superUser!.id
      }
    });
    
    // Add Korean translations if provided
    const plantId = monthlyPlant.id.toString();
    
    if (titleKo) {
      await upsertTranslation('MonthlyPlant', plantId, 'title', 'ko', titleKo);
    }
    if (nameKo) {
      await upsertTranslation('MonthlyPlant', plantId, 'name', 'ko', nameKo);
    }
    if (descriptionKo) {
      await upsertTranslation('MonthlyPlant', plantId, 'description', 'ko', descriptionKo);
    }
    
    res.status(201).json(monthlyPlant);
  } catch (error) {
    console.error('Monthly plant creation error:', error);
    res.status(500).json({ message: 'Error creating monthly plant' });
  }
};

export const updateMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      title, titleKo,
      name, nameKo,
      description, descriptionKo,
      mainImageUrl, iconUrl, cropImageUrl, imageUrls 
    } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Build update data object with only provided fields
    const updateData: any = {
      updatedById: req.superUser!.id
    };
    
    if (title) updateData.title = title; // default (english)
    if (name) updateData.name = name; // default (english)
    if (description) updateData.description = description; // default (english)
    if (mainImageUrl) updateData.mainImageUrl = mainImageUrl;
    if (iconUrl) updateData.iconUrl = iconUrl;
    if (cropImageUrl) updateData.cropImageUrl = cropImageUrl;
    if (imageUrls) {
      if (!Array.isArray(imageUrls) || imageUrls.length !== 4) {
        return res.status(400).json({ 
          message: 'imageUrls array with exactly 4 images is required (SEED, SPROUT, GROWING, MATURE)' 
        });
      }
      updateData.imageUrls = imageUrls;
    }
    
    const updatedPlant = await prisma.monthlyPlant.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    });
    
    // Update Korean translations if provided
    const plantId = req.params.id;
    
    if (titleKo !== undefined) {
      await upsertTranslation('MonthlyPlant', plantId, 'title', 'ko', titleKo);
    }
    if (nameKo !== undefined) {
      await upsertTranslation('MonthlyPlant', plantId, 'name', 'ko', nameKo);
    }
    if (descriptionKo !== undefined) {
      await upsertTranslation('MonthlyPlant', plantId, 'description', 'ko', descriptionKo);
    }
    
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