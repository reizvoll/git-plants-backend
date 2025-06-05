import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    image?: string;
  };
  superUser?: {
    id: string;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
  };
}