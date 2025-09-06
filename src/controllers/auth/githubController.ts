import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { generateTokens } from '@/middlewares/authMiddleware';
import { fetchUserActivities, setupAutoSync, stopAutoSync } from '@/services/githubService';
import { AuthRequest } from '@/types/auth';
import axios from 'axios';
import { Request, Response } from 'express';
import { DefaultItemService } from '@/services/defaultItemService';

// start GitHub OAuth login for client
export const startGitHubAuth = (req: Request, res: Response) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${authConfig.github.clientId}&redirect_uri=${authConfig.github.callbackURL}&scope=${authConfig.github.scope}&state=client`;
  res.redirect(githubAuthUrl);
};

// start GitHub OAuth login for admin
export const startGitHubAuthAdmin = (req: Request, res: Response) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${authConfig.github.clientId}&redirect_uri=${authConfig.github.callbackURL}&scope=${authConfig.github.scope}&state=admin`;
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
  const { code, state } = req.query;
  
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

    console.log('GitHub token response:', tokenResponse.data);
    const { access_token } = tokenResponse.data;
    
    if (!access_token) {
      console.error('No access_token in response:', tokenResponse.data);
      throw new Error('Failed to get access token from GitHub');
    }

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
      // Super users get both admin and client tokens for full access
      const clientTokens = await generateTokens(user.id, false);

      // Set admin cookies
      res.cookie(authConfig.cookie.admin.accessTokenName, tokens.accessToken, {
        ...authConfig.cookie.admin.options,
        maxAge: 60 * 60 * 1000 // 1 hour (increased from 15 minutes)
      });

      res.cookie(authConfig.cookie.admin.refreshTokenName, tokens.refreshToken, {
        ...authConfig.cookie.admin.options,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Set client cookies
      res.cookie(authConfig.cookie.client.accessTokenName, clientTokens.accessToken, {
        ...authConfig.cookie.client.options,
        maxAge: 60 * 60 * 1000 // 1 hour
      });

      res.cookie(authConfig.cookie.client.refreshTokenName, clientTokens.refreshToken, {
        ...authConfig.cookie.client.options,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
    } else {
      // Set client cookies
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
      
      // Always ensure user has default items (for new users or when defaults change)
      await DefaultItemService.awardAllDefaultItems(user.id);
      
    } catch (error) {
      console.error('Error fetching GitHub activities during login:', error);
    }

    // redirect to frontend based on state parameter
    const redirectUrl = state === 'admin' ? process.env.ADMIN_URL : process.env.CLIENT_URL;
    res.redirect(`${redirectUrl}/auth/callback`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    const redirectUrl = state === 'admin' ? process.env.ADMIN_URL : process.env.CLIENT_URL;
    res.redirect(`${redirectUrl}/auth/error`);
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