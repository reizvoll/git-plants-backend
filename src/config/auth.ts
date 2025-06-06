import dotenv from 'dotenv';
import { SignOptions } from 'jsonwebtoken';

dotenv.config();

export const authConfig = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID!,
    clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    callbackURL: process.env.GITHUB_CALLBACK_URL!,
    scope: 'read:user user:email repo',
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    accessTokenExpiresIn: '1h' as SignOptions['expiresIn'],
    refreshTokenExpiresIn: '7d' as SignOptions['expiresIn'],
  },
  cookie: {
    admin: {
      accessTokenName: 'admin_access_token',
      refreshTokenName: 'admin_refresh_token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict' as const,
        path: '/admin',
      }
    },
    client: {
      accessTokenName: 'client_access_token',
      refreshTokenName: 'client_refresh_token',
      options: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict' as const,
        path: '/',
      }
    }
  }
}; 