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
}

export interface AccessTokenPayload extends JwtPayload {
    id: string;
    username: string;
    image?: string;
}

export interface RefreshTokenPayload {
    token: string;
    userId: string;
    expiresAt: Date;
}

export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
}

export interface UserPayload {
    id: string;
    username: string;
    image?: string;
}