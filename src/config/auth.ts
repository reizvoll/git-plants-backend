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
    expiresIn: '1d' as SignOptions['expiresIn'],
  },
  frontendURL: process.env.FRONTEND_URL!,
}; 