import prisma from '@/config/db';
import { createUser, deleteUser, getUser, updateUser } from '@/controllers/authController';
import { AuthRequest } from '@/types/auth';
import express from 'express';
import { clientAuth } from '../middlewares/authMiddleware';

const router = express.Router();

// Get user profile with all related information - accessible to both regular users and superusers
router.get('/profile', clientAuth, async (req: AuthRequest, res) => {
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
      prisma.plant.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
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
});

// User routes - these require authentication
router.post('/', clientAuth, createUser);
router.get('/:id', clientAuth, getUser);
router.put('/:id', clientAuth, updateUser);
router.delete('/:id', clientAuth, deleteUser);

export default router; 