import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

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
    return res.status(200).json({ message: 'User deleted successfully', user: req.user });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting admin user' });
  }
};

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
