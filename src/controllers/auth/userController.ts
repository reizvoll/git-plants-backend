import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { Response } from 'express';

// Get user profile with all related information
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const isAdmin = req.isAdmin;

    // Get all user information in parallel
    const [userInfo, userSeed, userBadges, equippedItems, plants] = await Promise.all([
      // Basic user info
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          username: true,
          image: true,
        },
      }),
      // User's seed count
      prisma.seed.findUnique({
        where: { userId },
        select: { count: true }
      }),
      // User's badges
      prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' }
      }),
      // User's equipped items (background and pot)
      prisma.userItem.findMany({
        where: { 
          userId,
          equipped: true
        },
        include: { 
          item: true 
        }
      }),
      // User's plants
      prisma.userPlant.findMany({
        where: { userId },
        include: { monthlyPlant: true },
        orderBy: { plantedAt: 'desc' }
      })
    ]);

    if (!userInfo) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Separate equipped items by category - return all equipped items
    const equippedBackgrounds = equippedItems.filter(item => 
      item.item.category === 'background' &&
      (item.item.mode === 'GARDEN' || item.item.mode === 'MINI')  // 배경화면은 GARDEN 또는 MINI 모드
    ).map(item => item.item);
    
    const equippedPots = equippedItems.filter(item => 
      item.item.category === 'pot'
    ).map(item => item.item);

    res.json({
      user: {
        ...userInfo,
        isAdmin
      },
      seedCount: userSeed?.count || 0,
      badges: userBadges,
      equipped: {
        backgrounds: equippedBackgrounds,
        pots: equippedPots
      },
      plants
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
}; 