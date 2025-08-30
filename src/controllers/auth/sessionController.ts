import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { generateTokens } from '@/middlewares/authMiddleware';
import { AuthRequest } from '@/types/auth';
import { Request, Response } from 'express';

// check session for client
export const getSession = async (req: AuthRequest, res: Response) => {
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
};

// refresh token endpoint
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const isAdmin = req.cookies[authConfig.cookie.admin.refreshTokenName] !== undefined;
    const cookieConfig = isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;
    const refreshToken = req.cookies[cookieConfig.refreshTokenName];

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const tokens = await generateTokens(storedToken.userId, storedToken.isAdmin);

    res.cookie(cookieConfig.accessTokenName, tokens.accessToken, {
      ...cookieConfig.options,
      maxAge: 60 * 60 * 1000 // 1 hour
    });

    res.cookie(cookieConfig.refreshTokenName, tokens.refreshToken, {
      ...cookieConfig.options,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.status(200).json({ 
      message: 'Token refreshed successfully',
      user: {
        id: storedToken.user.id,
        username: storedToken.user.username,
        image: storedToken.user.image,
      },
      isAdmin: storedToken.isAdmin
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(500).json({ message: 'Error refreshing token' });
  }
}; 