import { AuthRequest } from '@/types/auth';
import { ActivityFilter, GroupByStats, GroupByTimeline } from '@/types/github';
import express, { Response } from 'express';
import prisma from '../config/db';
import { clientAuth } from '../middlewares/authMiddleware';
import { autoSyncLimiter } from '../middlewares/rateLimiter';
import { setupAutoSync, stopAutoSync } from '../services/githubService';

const router = express.Router();
router.use(clientAuth);

// Get user's GitHub activities
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { period, type, repository } = req.query as {
      period?: string;
      type?: 'contribution' | 'commit' | 'pull_request';
      repository?: string;
    };
    const where: ActivityFilter = { userId: req.user!.id };

    if (period) {
      const now = new Date();
      const periods: { [key: string]: number } = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      if (periods[period]) {
        where.createdAt = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    if (type) {
      where.type = type;
    }

    if (repository) {
      where.repository = repository;
    }

    const activities = await prisma.gitHubActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activities' });
  }
});

// Get activity statistics
router.get('/stats', async (req: AuthRequest, res: Response) => {
  try {
    const { period } = req.query as { period?: string };
    const where: ActivityFilter = { userId: req.user!.id };

    if (period) {
      const now = new Date();
      const periods: { [key: string]: number } = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      if (periods[period]) {
        where.createdAt = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    const stats = await prisma.gitHubActivity.groupBy({
      by: ['type'],
      where,
      _count: true
    });

    const totalCount = stats.reduce((acc: number, curr: GroupByStats) => acc + curr._count, 0);

    res.json({
      total: totalCount,
      byType: stats
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contribution stats' });
  }
});

// Get contribution analytics
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const { period, year } = req.query as { period?: string; year?: string };
    const where: ActivityFilter = {
      userId: req.user!.id,
      type: 'contribution', // Use 'contribution' for consistency
    };

    if (period === 'all') {
      // No date filtering for 'all' period
    } else if (period === 'year' && year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
      where.createdAt = {
        gte: startDate,
        lte: endDate
      };
    } else if (period) {
      const now = new Date();
      const periods: { [key: string]: number } = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000
      };
      if (periods[period]) {
        where.createdAt = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    const timeline = await prisma.gitHubActivity.groupBy({
      by: ['createdAt'],
      where,
      _sum: { contributionCount: true },
      orderBy: { createdAt: 'asc' }
    });

    const timelineForFrontend = timeline.map((day: GroupByTimeline) => ({
      date: day.createdAt,
      count: day._sum.contributionCount || 0
    }));

    const repositoryDistribution = await prisma.gitHubActivity.groupBy({
      by: ['repository'],
      where,
      _count: true
    });

    const timePattern = await prisma.gitHubActivity.groupBy({
      by: ['createdAt'],
      where,
      _count: true
    });

    // Get available years
    const availableYears = await prisma.gitHubActivity.findMany({
      where: {
        userId: req.user!.id,
        type: 'contribution'  // Only contributions
      },
      select: {
        createdAt: true
      },
      distinct: ['createdAt']
    });

    // Convert to years and sort
    const yearsArray = availableYears.map((activity: { createdAt: Date }) => new Date(activity.createdAt).getFullYear());
    const years = [...(new Set(yearsArray) as Set<number>)].sort((a, b) => b - a);

    res.json({
      success: true,
      data: {
        timeline: timelineForFrontend,
        repositoryDistribution,
        timePattern,
        availableYears: years
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contribution analytics' 
    });
  }
});

// Get contribution details by ID
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const activity = await prisma.gitHubActivity.findUnique({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });
    if (!activity) {
      return res.status(404).json({ message: 'Contribution not found' });
    }
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contribution details' });
  }
});

// Sync GitHub activities automatically
router.post('/sync/auto', autoSyncLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body as { enabled: boolean };

    if (enabled) {
      const success = await setupAutoSync(req.user!.id);
      if (!success) {
        return res.status(400).json({ message: 'Failed to setup auto sync' });
      }
      res.json({ message: 'Auto sync enabled successfully' });
    } else {
      const success = stopAutoSync(req.user!.id);
      if (!success) {
        return res.status(400).json({ message: 'Auto sync was not enabled' });
      }
      res.json({ message: 'Auto sync disabled successfully' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error updating auto sync settings' });
  }
});

export default router;