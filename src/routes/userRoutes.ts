import prisma from '@/config/db';
import { createUser, deleteUser, getUser, updateUser } from '@/controllers/authController';
import { AuthRequest } from '@/types/auth';
import express from 'express';
import { authToken } from '../middlewares/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authToken);

// Get user profile with all related information
router.get('/profile', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Get all user information in parallel
    const [userInfo, seedCount, userBadges, equippedItems, plants] = await Promise.all([
      // Basic user info
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          username: true,
          image: true,
        },
      }),
      // Total seed count
      prisma.seed.count({
        where: { userId }
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

    // Separate equipped items by category
    const equippedBackground = equippedItems.find(item => item.item.category === 'BACKGROUND');
    const equippedPot = equippedItems.find(item => item.item.category === 'POT');

    res.json({
      user: userInfo,
      seedCount,  // Return seed counts
      badges: userBadges,
      equipped: {
        background: equippedBackground?.item || null,
        pot: equippedPot?.item || null
      },
      plants
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error fetching user profile' });
  }
});

// User routes
router.post('/', createUser);
router.get('/:id', getUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router; 