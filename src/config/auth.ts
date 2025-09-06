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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as 'strict' | 'lax' | 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN && { 
          domain: process.env.COOKIE_DOMAIN 
        })
      }
    },
    client: {
      accessTokenName: 'client_access_token',
      refreshTokenName: 'client_refresh_token',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as 'strict' | 'lax' | 'none',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        ...(process.env.NODE_ENV === 'production' && process.env.COOKIE_DOMAIN && { 
          domain: process.env.COOKIE_DOMAIN 
        })
      }
    }
  }
}; 