import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

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

export const createGardenItem = async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, iconUrl, price, mode } = req.body;

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

    // SuperUser validation is already done in adminAuth middleware

    const gardenItem = await prisma.gardenItem.create({
      data: {
        name,
        category,
        imageUrl,
        iconUrl,
        price: parseInt(price),
        mode: mode || 'default',
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
    const { name, category, imageUrl, price, mode } = req.body;
    
    // Check if mode is required for background category
    if (category === 'background' && !mode) {
      return res.status(400).json({
        message: 'Mode is required for background category'
      });
    }
    
    // SuperUser validation is already done in adminAuth middleware
    
    const updatedItem = await prisma.gardenItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        category,
        imageUrl,
        price: parseInt(price),
        mode: mode || 'default',
        updatedById: req.superUser!.id
      }
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
    
    // SuperUser validation is already done in adminAuth middleware
    
    const badge = await prisma.badge.create({
      data: {
        name,
        condition,
        imageUrl,
        updatedById: req.superUser!.id
      }
    });
    
    res.status(201).json(badge);
  } catch (error) {
    console.error('Badge creation error:', error);
    res.status(500).json({ message: 'Error creating badge' });
  }
};

export const updateBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    const updatedBadge = await prisma.badge.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        condition,
        imageUrl,
        updatedById: req.superUser!.id
      }
    });
    
    res.json(updatedBadge);
  } catch (error) {
    console.error('Badge update error:', error);
    res.status(500).json({ message: 'Error updating badge' });
  }
};