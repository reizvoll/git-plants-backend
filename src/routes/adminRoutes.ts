import prisma from '@/config/db';
import { adminAuth } from '@/middlewares/authMiddleware';
import { AuthRequest } from '@/types/auth';
import express, { Response } from 'express';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// Get admin dashboard stats
router.get('/stats', async (req: AuthRequest, res: Response) => {
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

// MONTHLY PLANT MANAGEMENT
router.get('/monthly-plants', async (req: AuthRequest, res: Response) => {
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

router.post('/monthly-plants', async (req: AuthRequest, res: Response) => {
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
        updatedById: req.user!.id
      }
    });
    
    res.status(201).json(monthlyPlant);
  } catch (error) {
    res.status(500).json({ message: 'Error creating monthly plant' });
  }
});

router.put('/monthly-plants/:id', async (req: AuthRequest, res: Response) => {
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
});

// GARDEN ITEM MANAGEMENT
router.get('/items', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.gardenItem.findMany({
      orderBy: { category: 'asc' }
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching items' });
  }
});

router.post('/items', async (req: AuthRequest, res: Response) => {
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
        updatedById: req.user!.id
      }
    });
    
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error creating item' });
  }
});

router.put('/items/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { name, category, imageUrl, price } = req.body;
    
    const updatedItem = await prisma.gardenItem.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        category,
        imageUrl,
        price: parseInt(price),
        updatedById: req.user!.id
      }
    });
    
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: 'Error updating item' });
  }
});

// BADGE MANAGEMENT
router.get('/badges', async (req: AuthRequest, res: Response) => {
  try {
    const badges = await prisma.badge.findMany();
    res.json(badges);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching badges' });
  }
});

router.post('/badges', async (req: AuthRequest, res: Response) => {
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
        updatedById: req.user!.id
      }
    });
    
    res.status(201).json(badge);
  } catch (error) {
    res.status(500).json({ message: 'Error creating badge' });
  }
});

router.put('/badges/:id', async (req: AuthRequest, res: Response) => {
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
});

// ADMIN USER MANAGEMENT
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const superUsers = await prisma.superUser.findMany({
      include: { user: true }
    });
    res.json(superUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admin users' });
  }
});

router.post('/users', async (req: AuthRequest, res: Response) => {
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
});

router.delete('/users/:id', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.superUser.delete({
      where: { id: req.params.id }
    });
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Error deleting admin user' });
  }
});

export default router; 