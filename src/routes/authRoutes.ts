import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { clientAuth, generateTokens, logout } from '@/middlewares/authMiddleware';
import { loginLimiter } from '@/middlewares/rateLimiter';
import { AuthRequest } from '@/types/auth';
import axios from 'axios';
import express, { Response } from 'express';

const router = express.Router();

// start GitHub OAuth login
router.get('/github', loginLimiter, (req, res) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${authConfig.github.clientId}&redirect_uri=${authConfig.github.callbackURL}&scope=${authConfig.github.scope}`;
    res.redirect(githubAuthUrl);
});

// GitHub OAuth callback
router.get('/callback/github', async (req, res) => {
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

    // generate tokens
    const tokens = await generateTokens(user.id, false);

    // set cookies
    res.cookie(authConfig.cookie.client.accessTokenName, tokens.accessToken, {
      ...authConfig.cookie.client.options,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie(authConfig.cookie.client.refreshTokenName, tokens.refreshToken, {
      ...authConfig.cookie.client.options,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    // redirect to frontend
    res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
});

// check session
router.get('/session', clientAuth, async (req: AuthRequest, res: Response) => {
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

    res.json({
      user,
      isAdmin: !!superUser
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching session' });
  }
});

// logout
router.post('/signout', clientAuth, logout);

export default router; 