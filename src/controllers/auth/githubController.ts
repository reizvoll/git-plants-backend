import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { generateTokens } from '@/middlewares/authMiddleware';
import { fetchUserActivities, setupAutoSync, stopAutoSync } from '@/services/githubService';
import { AuthRequest } from '@/types/auth';
import { ActivityFilter } from '@/types/github';
import axios from 'axios';
import { Request, Response } from 'express';

// start GitHub OAuth login
export const startGitHubAuth = (req: Request, res: Response) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${authConfig.github.clientId}&redirect_uri=${authConfig.github.callbackURL}&scope=${authConfig.github.scope}`;
  res.redirect(githubAuthUrl);
};

// Auto-create current month's plant for new login
async function autoCreateCurrentMonthPlant(userId: string) {
  try {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    
    // Check if current month's plant exists
    const monthlyPlant = await prisma.monthlyPlant.findFirst({
      where: {
        month: currentMonth,
        year: currentYear
      }
    });
    
    if (!monthlyPlant) {
      console.log(`No monthly plant found for ${currentMonth}/${currentYear}`);
      return;
    }
    
    // Check if user already has this month's plant
    const existingUserPlant = await prisma.userPlant.findFirst({
      where: {
        userId,
        monthlyPlantId: monthlyPlant.id
      }
    });
    
    if (existingUserPlant) {
      console.log(`User already has plant for ${currentMonth}/${currentYear}`);
      return;
    }
    
    // Create new UserPlant for current month
    const newUserPlant = await prisma.userPlant.create({
      data: {
        userId,
        monthlyPlantId: monthlyPlant.id,
        stage: 'SEED'
      },
      include: {
        monthlyPlant: true
      }
    });
    
    console.log(`Auto-created plant for user: ${newUserPlant.id} (${monthlyPlant.name})`);
    return newUserPlant;
    
  } catch (error) {
    console.error('Error auto-creating current month plant:', error);
  }
}

// GitHub OAuth callback
export const githubCallback = async (req: Request, res: Response) => {
  const { code } = req.query;
  
  try {
    // get GitHub access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: authConfig.github.clientId,
      client_secret: authConfig.github.clientSecret,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      },
    });

    const { access_token } = tokenResponse.data;

    // get GitHub user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const githubUser = userResponse.data;

    // save or update user info
    const userData = {
      githubId: githubUser.id.toString(),
      username: githubUser.login,
      accessToken: access_token,
      image: githubUser.avatar_url,
    };

    const user = await prisma.user.upsert({
      where: { githubId: githubUser.id.toString() },
      update: userData,
      create: userData,
    });

    // Check if user is admin
    const superUser = await prisma.superUser.findUnique({
      where: { userId: user.id }
    });

    // generate tokens
    const tokens = await generateTokens(user.id, !!superUser);

    // set cookies based on user type
    if (superUser) {
      // Set admin cookies with improved settings
      res.cookie(authConfig.cookie.admin.accessTokenName, tokens.accessToken, {
        ...authConfig.cookie.admin.options,
        maxAge: 60 * 60 * 1000 // 1 hour (increased from 15 minutes)
      });

      res.cookie(authConfig.cookie.admin.refreshTokenName, tokens.refreshToken, {
        ...authConfig.cookie.admin.options,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    } else {
      // Set client cookies with improved settings
      res.cookie(authConfig.cookie.client.accessTokenName, tokens.accessToken, {
        ...authConfig.cookie.client.options,
        maxAge: 60 * 60 * 1000 // 1 hour (increased from 15 minutes)
      });

      res.cookie(authConfig.cookie.client.refreshTokenName, tokens.refreshToken, {
        ...authConfig.cookie.client.options,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    }

    try {
      // Automatically fetch GitHub activities and setup auto sync
      await fetchUserActivities(user.id, user.username);
      await setupAutoSync(user.id);
      
      // Auto-create current month's plant
      await autoCreateCurrentMonthPlant(user.id);
      
    } catch (error) {
      console.error('Error fetching GitHub activities during login:', error);
    }

    // redirect to frontend
    res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
}; 

// Get user's GitHub activities
export const getUserActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { period } = req.query as {
      period?: string;
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
        where.date = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    const activities = await prisma.gitHubActivity.findMany({
      where,
      orderBy: { date: 'desc' }
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activities' });
  }
};

// Get activity statistics
export const getActivityStats = async (req: AuthRequest, res: Response) => {
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
        where.date = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    const stats = await prisma.gitHubActivity.aggregate({
      where,
      _count: true,
      _sum: { count: true }
    });

    res.json({
      total: stats._count,
      totalContributions: stats._sum.count || 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contribution stats' });
  }
};

// Get contribution analytics
export const getActivityAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { period, year } = req.query as { period?: string; year?: string };
    const where: ActivityFilter = {
      userId: req.user!.id,
    };

    if (period === 'all') {
      // No date filtering for 'all' period
    } else if (period === 'year' && year) {
      const startDate = new Date(parseInt(year), 0, 1);
      const endDate = new Date(parseInt(year), 11, 31, 23, 59, 59);
      where.date = {
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
        where.date = {
          gte: new Date(now.getTime() - periods[period]),
        };
      }
    }

    // Get timeline data
    const activities = await prisma.gitHubActivity.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    const timeline = activities.map(activity => ({
      date: activity.date,
      count: activity.count
    }));

    // Get available years
    const availableYears = await prisma.gitHubActivity.findMany({
      where: {
        userId: req.user!.id,
      },
      select: {
        date: true
      },
      distinct: ['date']
    });

    // Convert to years and sort
    const yearsArray = availableYears.map((activity: { date: Date }) => new Date(activity.date).getFullYear());
    const years = [...(new Set(yearsArray) as Set<number>)].sort((a, b) => b - a);

    res.json({
      success: true,
      data: {
        timeline,
        availableYears: years
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contribution analytics' 
    });
  }
};

// Get contribution details by ID
export const getActivityById = async (req: AuthRequest, res: Response) => {
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
};

// Toggle GitHub activities auto sync
export const toggleAutoSync = async (req: AuthRequest, res: Response) => {
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
}; 