import prisma from '@/config/db';
import { authToken } from '@/middlewares/authMiddleware';
import type { AuthRequest } from '@/types/auth';
import express, { Response } from 'express';

// Define AdminRole type
type AdminRole = 'ADMIN' | 'CONTENT' | 'SHOP_MANAGER';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authToken);

// Middleware to check if user is an admin
const isAdmin = async (req: AuthRequest, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const superUser = await prisma.superUser.findUnique({
    where: { userId: req.user.id }
  });

  if (!superUser) {
    return res.status(403).json({ message: 'Forbidden: Admin access required' });
  }

  // Add superUser to request for role-based access control
  req.superUser = superUser;
  next();
};

// Role-based access control middleware
const requireRole = (roles: AdminRole[]) => {
  return (req: AuthRequest, res: Response, next: Function) => {
    if (!req.superUser) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.superUser.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }

    next();
  };
};

// Apply admin check middleware to all routes
router.use(isAdmin);

// Get admin dashboard stats - ADMIN only
router.get('/stats', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
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
});

// MONTHLY PLANT MANAGEMENT - CONTENT and ADMIN
router.get('/monthly-plants', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
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
});

router.post('/monthly-plants', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl, month, year } = req.body;
    
    // Basic validation
    if (!title || !description || !imageUrl || !month || !year) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Check for existing entry for this month/year
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
        updatedById: req.superUser!.id
      }
    });
    
    res.status(201).json(monthlyPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating monthly plant' });
  }
});

router.put('/monthly-plants/:id', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, imageUrl } = req.body;
    
    const updatedPlant = await prisma.monthlyPlant.update({
      where: { id: parseInt(req.params.id) },
      data: {
        title,
        description,
        imageUrl,
        updatedById: req.superUser!.id
      }
    });
    
    res.json(updatedPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error updating monthly plant' });
  }
});

// GARDEN ITEM MANAGEMENT - SHOP_MANAGER and ADMIN
router.get('/items', requireRole(['ADMIN', 'SHOP_MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.gardenItem.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items' });
  }
});

router.post('/items', requireRole(['ADMIN', 'SHOP_MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, price } = req.body;
    
    // Basic validation
    if (!name || !category || !imageUrl || price === undefined) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const item = await prisma.gardenItem.create({
      data: {
        name,
        category,
        imageUrl,
        price: parseInt(price),
        updatedById: req.superUser!.id
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating item' });
  }
});

router.put('/items/:id', requireRole(['ADMIN', 'SHOP_MANAGER']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, price } = req.body;
    
    const updatedItem = await prisma.gardenItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        category,
        imageUrl,
        price: parseInt(price),
        updatedById: req.superUser!.id
      }
    });
    
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item' });
  }
});

// BADGE MANAGEMENT - CONTENT and ADMIN
router.get('/badges', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badges' });
  }
});

router.post('/badges', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
    // Basic validation
    if (!name || !condition || !imageUrl) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
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
    res.status(500).json({ message: 'Error creating badge' });
  }
});

router.put('/badges/:id', requireRole(['ADMIN', 'CONTENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, condition, imageUrl } = req.body;
    
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
    res.status(500).json({ message: 'Error updating badge' });
  }
});

// ADMIN USER MANAGEMENT - ADMIN only
router.get('/users', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const superUsers = await prisma.superUser.findMany({
      include: { user: true }
    });
    res.json(superUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin users' });
  }
});

router.post('/users', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if user is already an admin
    const existingSuperUser = await prisma.superUser.findUnique({
      where: { userId }
    });
    
    if (existingSuperUser) {
      return res.status(409).json({ message: 'User is already an admin' });
    }
    
    const superUser = await prisma.superUser.create({
      data: {
        userId,
        role: role || 'ADMIN'
      }
    });
    
    res.status(201).json(superUser);
  } catch (error) {
    res.status(500).json({ message: 'Error adding admin user' });
  }
});

router.put('/users/:id', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    
    const updatedSuperUser = await prisma.superUser.update({
      where: { id: req.params.id },
      data: { role }
    });
    
    res.json(updatedSuperUser);
  } catch (error) {
    res.status(500).json({ message: 'Error updating admin user' });
  }
});

router.delete('/users/:id', requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.superUser.delete({
      where: { id: req.params.id }
    });
    
    res.json({ message: 'Admin user removed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing admin user' });
  }
});

export default router; 