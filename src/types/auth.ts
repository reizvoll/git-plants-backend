import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

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
  isAdmin?: boolean;
}

export interface AccessTokenPayload extends JwtPayload {
    id: string;
    username: string;
    image?: string;
    isAdmin: boolean;
}

export type TokenResponse = {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export type UserPayload = {
    id: string;
    username: string;
    image?: string;
}