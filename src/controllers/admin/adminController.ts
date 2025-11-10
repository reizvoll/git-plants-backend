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

// USER MANAGEMENT

// Get all users
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        superUser: true,
        seeds: true,
        _count: {
          select: {
            userItems: true,
            userBadges: true,
            userPlants: true,
            userCrops: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
};

// Get user by ID with detailed information
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        superUser: true,
        seeds: true,
        userItems: {
          include: {
            item: true
          }
        },
        userBadges: {
          include: {
            badge: true
          }
        },
        userPlants: {
          include: {
            monthlyPlant: true
          }
        },
        userCrops: {
          include: {
            monthlyPlant: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error fetching user' });
  }
};

// Update user (grant items, seeds, badges)
export const updateUserById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const { grantItems, grantSeeds, deductSeeds, grantBadges } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Grant items
    if (grantItems && Array.isArray(grantItems) && grantItems.length > 0) {
      const itemGrants = grantItems.map((itemId: number) => ({
        userId,
        itemId,
        equipped: false
      }));

      await prisma.userItem.createMany({
        data: itemGrants,
        skipDuplicates: true
      });
    }

    // Grant seeds
    if (grantSeeds && grantSeeds > 0) {
      await prisma.seed.upsert({
        where: { userId },
        update: {
          count: { increment: grantSeeds }
        },
        create: {
          userId,
          count: grantSeeds
        }
      });
    }

    // Deduct seeds
    if (deductSeeds && deductSeeds > 0) {
      const currentSeeds = await prisma.seed.findUnique({
        where: { userId }
      });

      if (!currentSeeds || currentSeeds.count < deductSeeds) {
        return res.status(400).json({ message: 'Not enough seeds to deduct' });
      }

      await prisma.seed.update({
        where: { userId },
        data: {
          count: { decrement: deductSeeds }
        }
      });
    }

    // Grant badges
    if (grantBadges && Array.isArray(grantBadges) && grantBadges.length > 0) {
      const badgeGrants = grantBadges.map((badgeId: number) => ({
        userId,
        badgeId
      }));

      await prisma.userBadge.createMany({
        data: badgeGrants,
        skipDuplicates: true
      });
    }

    // Return updated user data
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        seeds: true,
        userItems: {
          include: {
            item: true
          }
        },
        userBadges: {
          include: {
            badge: true
          }
        }
      }
    });

    return res.status(200).json({
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
};

// Delete user
export const deleteUserById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user (cascade will handle related data)
    await prisma.user.delete({
      where: { id: userId }
    });

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
};
