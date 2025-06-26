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
      prisma.plant.count(),
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

export const createMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, month, year } = req.body;
    
    if (!title || !description || !imageUrl || !month || !year) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
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
        description,
        imageUrl,
        month: parseInt(month),
        year: parseInt(year),
        updatedById: req.user!.id
      }
    });
    
    res.status(201).json(monthlyPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating monthly plant' });
  }
};

export const updateMonthlyPlant = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl } = req.body;
    
    const updatedPlant = await prisma.monthlyPlant.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        description,
        imageUrl,
        updatedById: req.user!.id
      }
    });
    
    res.json(updatedPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating monthly plant' });
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

    const superUser = await prisma.superUser.findUnique({
      where: { userId: req.user!.id }
    });

    if (!superUser) {
      return res.status(403).json({ 
        message: 'Not authorized as admin' 
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
        updatedById: superUser.id
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
    
    const updatedItem = await prisma.gardenItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        category,
        imageUrl,
        price: parseInt(price),
        mode: mode || 'default',
        updatedById: req.user!.id
      }
    });
    
    res.json(category === 'background' ? updatedItem : { ...updatedItem, mode: undefined });
  } catch (error) {
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
    
    const badge = await prisma.badge.create({
      data: {
        name,
        condition,
        imageUrl,
        updatedById: req.user!.id
      }
    });
    
    res.status(201).json(badge);
  } catch (error) {
    res.status(500).json({ message: 'Error creating badge' });
  }
};

export const updateBadge = async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
    const updatedBadge = await prisma.badge.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        condition,
        imageUrl,
        updatedById: req.user!.id
      }
    });
    
    res.json(updatedBadge);
  } catch (error) {
    res.status(500).json({ message: 'Error updating badge' });
  }
};

export const getAdminUsers = async (req: AuthRequest, res: Response) => {
  try {
    const superUsers = await prisma.superUser.findMany({
      include: { user: true }
    });
    res.json(superUsers);
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
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Error deleting admin user' });
  }
}; 