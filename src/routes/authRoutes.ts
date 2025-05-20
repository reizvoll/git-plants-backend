import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { authToken } from '@/middlewares/authMiddleware';
import axios from 'axios';
import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// start GitHub OAuth login
router.get('/github', (req, res) => {
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

    // create JWT token - exclude accessToken for security
    const payload = { 
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      image: user.image
    };

    const token = jwt.sign(
      payload,
      authConfig.jwt.secret,
      { expiresIn: authConfig.jwt.expiresIn }
    );

    // send token to cookie (instead of URL parameter)
    res.cookie('auth_token', token, {
      httpOnly: true,  // JavaScript cannot access
      secure: true, // required for HTTPS (development and production)
      sameSite: 'none',  // for cross-domain cookies
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    // redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback`);
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/error`);
  }
});

// check session
router.get('/session', authToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        githubId: true,
        username: true,
        image: true,
      },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching session' });
  }
});

// logout - remove cookie
router.post('/signout', (req, res) => {
  res.cookie('auth_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    expires: new Date(0)
  });
  res.json({ message: 'Signed out successfully' });
});

export default router; 