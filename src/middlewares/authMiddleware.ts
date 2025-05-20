import { authConfig } from '@/config/auth';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        githubId: string;
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
      githubId: string;
      username: string;
      image?: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}; 