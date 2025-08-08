import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';
import { addBadgeService, updateBadgeService, deleteBadgeService } from '@/services/badgeService';

// for garden item(background, pot)
export const getGardenItems = async (req: AuthRequest, res: Response) => {
    try {
      const items = await prisma.gardenItem.findMany({
        orderBy: { category: 'asc' }
      });
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching items' });
    }
  };

export const getGardenItemById = async (req: AuthRequest, res: Response) => {
    try {
      const item = await prisma.gardenItem.findUnique({
        where: { id: parseInt(req.params.id) }
      });
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching item' });
    }
  };

export const createGardenItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, iconUrl, price, mode, isAvailable } = req.body;

    if (!name || !category || !imageUrl || !iconUrl || price === undefined || price === null) {
      return res.status(400).json({ 
        message: 'All fields are required' 
      });
    }

    if (category === 'background' && !mode) {
      return res.status(400).json({
        message: 'Mode is required for background category'
      });
    }

      const gardenItem = await prisma.gardenItem.create({
        data: {
          name,
          category,
          imageUrl,
          iconUrl,
          price: parseInt(price),
          mode: mode || 'default',
          isAvailable: isAvailable === 'true',
          updatedById: req.superUser!.id
        }
      });

      res.json({ 
        data: category === 'background' ? gardenItem : { ...gardenItem, mode: undefined }
      });
    } catch (error) {
      console.error('Item creation error:', error);
      res.status(500).json({ 
        message: 'Item creation failed' 
      });
    }
  };

export const updateGardenItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, price, mode, isAvailable } = req.body;
    
    // Check if mode is required for background category
    if (category === 'background' && !mode) {
      return res.status(400).json({
        message: 'Mode is required for background category'
      });
    }
      
      const updateData: {
        name?: string;
        category?: string;
        imageUrl?: string;
        price?: number;
        mode?: string;
        isAvailable?: boolean;
        updatedBy: { connect: { id: string } };
      } = {
        updatedBy: { connect: { id: req.superUser!.id } }
      };

      // update only if the field is not undefined (conditional field update)
      if (name !== undefined) updateData.name = name;
      if (category !== undefined) updateData.category = category;
      if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
      if (price !== undefined) updateData.price = parseInt(price);
      if (mode !== undefined) updateData.mode = mode;
      if (isAvailable !== undefined) updateData.isAvailable = isAvailable === 'true';

      const updatedItem = await prisma.gardenItem.update({
        where: { id: parseInt(req.params.id) },
        data: updateData  // only includes fields that were provided
      });
      
      res.json(category === 'background' ? updatedItem : { ...updatedItem, mode: undefined });
    } catch (error) {
      console.error('Garden item update error:', error);
      res.status(500).json({ message: 'Error updating item' });
    }
  };

export const deleteGardenItem = async (req: AuthRequest, res: Response) => {
    try {
      await prisma.gardenItem.delete({
        where: { id: parseInt(req.params.id) }
      });
      res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
      console.error('Garden item deletion error:', error);
      res.status(500).json({ message: 'Error deleting item' });
    }
  };

// for badge
export const getBadges = async (req: AuthRequest, res: Response) => {
    try {
      const badges = await prisma.badge.findMany();
      res.json(badges);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching badges' });
    }
  };

export const createBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
    if (!name || !condition || !imageUrl) {
      return res.status(400).json({ message: 'All fields are required' });
    }
      
    // use badgeService (cache invalidation included)
    await addBadgeService({ name, condition, imageUrl });
    
    res.status(201).json({ message: 'Badge created successfully' });
  } catch (error) {
    console.error('Badge creation error:', error);
    res.status(500).json({ message: 'Error creating badge' });
  }
};

export const updateBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
    const updateData: {
      name?: string;
      condition?: string;
      imageUrl?: string;
      updatedById: string;
    } = {
      updatedById: req.superUser!.id
    };

    // update only if the field is not undefined (conditional field update)
    if (name !== undefined) updateData.name = name;
    if (condition !== undefined) updateData.condition = condition;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    
    // use badgeService (cache invalidation included)
    await updateBadgeService(parseInt(req.params.id), updateData);
    
      res.json({ message: 'Badge updated successfully' });
  } catch (error) {
    console.error('Badge update error:', error);
    res.status(500).json({ message: 'Error updating badge' });
  }
};

export const deleteBadge = async (req: AuthRequest, res: Response) => {
  try {
    const badgeId = parseInt(req.params.id);
    
    // use badgeService (cache invalidation included)
    await deleteBadgeService(badgeId);
    
    res.status(200).json({ message: 'Badge deleted successfully' });
  } catch (error) {
    console.error('Badge deletion error:', error);
    res.status(500).json({ message: 'Error deleting badge' });
  }
};