import { Request } from 'express';

// Extend the Request interface to include user from authenticateToken middleware
export interface AuthRequest extends Request {
  user?: {
    id: string;
    githubId: string;
    username: string;
    image?: string;
  };
  superUser?: {
    id: string;
    userId: string;
    role: 'ADMIN' | 'CONTENT' | 'SHOP_MANAGER';
    createdAt: Date;
    updatedAt: Date;
  };
}