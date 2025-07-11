import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

export const getAdminSession = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const [user, superUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          username: true,
          image: true,
        },
      }),
      prisma.superUser.findUnique({
        where: { userId: req.user.id },
      }),
    ]);

    if (!superUser) {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    res.json({
      user,
      isAdmin: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin session' });
  }
};

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers,
      totalPlants,
      totalItems,
      totalBadges,
      recentUsers
    ] = await Promise.all([
      prisma.user.count(),
      prisma.userPlant.count(),
      prisma.gardenItem.count(),
      prisma.badge.count(),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          image: true,
          createdAt: true
        }
      })
    ]);

    res.json({
      totalUsers,
      totalPlants,
      totalItems,
      totalBadges,
      recentUsers
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin stats' });
  }
};

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

export const getAdminUsers = async (req: AuthRequest, res: Response) => {
  try {
    const superUsers = await prisma.superUser.findMany({
      include: { user: true }
    });
    return res.status(200).json(superUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin users' });
  }
};

export const createAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    const superUser = await prisma.superUser.create({
      data: {
        userId
      },
      include: { user: true }
    });
    
    res.status(201).json(superUser);
  } catch (error) {
    res.status(500).json({ message: 'Error creating admin user' });
  }
};

export const deleteAdminUser = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.superUser.delete({
      where: { id: req.params.id }
    });
    return res.status(200).json({ message: "User deleted successfully", user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting admin user' });
  }
};

// UPDATE NOTE MANAGEMENT
export const getUpdateNotes = async (req: AuthRequest, res: Response) => {
  try {
    const updateNotes = await prisma.updateNote.findMany({
      include: {
        gardenItems: true
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.json(updateNotes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching update notes' });
  }
};

export const createUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, month, year, gardenItemIds } = req.body;
    
    if (!title || !description || !imageUrl || !month || !year) {
      return res.status(400).json({ 
        message: 'Title, description, imageUrl, month, and year are required' 
      });
    }
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Check if update note already exists for this month/year
    const existingUpdateNote = await prisma.updateNote.findFirst({
      where: {
        month: parseInt(month),
        year: parseInt(year)
      }
    });
    
    if (existingUpdateNote) {
      return res.status(409).json({ 
        message: 'An update note already exists for this month and year' 
      });
    }
    
    // Create update note
    const updateNote = await prisma.updateNote.create({
      data: {
        title,
        description,
        imageUrl,
        month: parseInt(month),
        year: parseInt(year),
        updatedById: req.superUser!.id,
        gardenItems: gardenItemIds ? {
          connect: gardenItemIds.map((id: number) => ({ id }))
        } : undefined
      },
      include: {
        gardenItems: true
      }
    });
    
    res.status(201).json(updateNote);
  } catch (error) {
    console.error('Update note creation error:', error);
    res.status(500).json({ message: 'Error creating update note' });
  }
};

export const updateUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, isActive, gardenItemIds } = req.body;
    
    // SuperUser validation is already done in adminAuth middleware
    
    // Build update data
    const updateData: any = {
      updatedById: req.superUser!.id
    };
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Handle garden items relationship
    if (gardenItemIds !== undefined) {
      updateData.gardenItems = {
        set: [], // Clear existing connections
        connect: gardenItemIds.map((id: number) => ({ id }))
      };
    }
    
    const updatedNote = await prisma.updateNote.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        gardenItems: true
      }
    });
    
    res.json(updatedNote);
  } catch (error) {
    console.error('Update note update error:', error);
    res.status(500).json({ message: 'Error updating update note' });
  }
}; 

export const deleteUpdateNote = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.updateNote.delete({
      where: { id: parseInt(req.params.id) }
    });
    res.status(200).json({ message: 'Update note deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting update note' });
  }
};