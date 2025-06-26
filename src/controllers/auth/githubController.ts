import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { generateTokens } from '@/middlewares/authMiddleware';
import axios from 'axios';
import { Request, Response } from 'express';

// start GitHub OAuth login
export const startGitHubAuth = (req: Request, res: Response) => {
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${authConfig.github.clientId}&redirect_uri=${authConfig.github.callbackURL}&scope=${authConfig.github.scope}`;
  res.redirect(githubAuthUrl);
};

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

    // redirect to frontend
    res.redirect(`${process.env.CLIENT_URL}/auth/callback`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${process.env.CLIENT_URL}/auth/error`);
  }
}; 