import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AuthRequest } from '@/types/auth';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        image?: string;
      };
    }
  }
}

export const authToken = (req: Request, res: Response, next: NextFunction) => {
  // check token is vaild in Authorization header
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];
  
  // check token is vaild in cookie
  const cookieToken = req.cookies?.auth_token;
  
  // get token from header or cookie
  const token = headerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, authConfig.jwt.secret) as {
      id: string;
      username: string;
      image?: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}; 

export const isAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
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