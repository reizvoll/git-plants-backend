import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AccessTokenPayload } from '@/types/auth';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateTokens, isTokenBlacklisted } from './authMiddleware';

// client auth middleware
export const clientAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check both client and admin tokens
        const token = req.cookies[authConfig.cookie.client.accessTokenName] ||
                     req.cookies[authConfig.cookie.admin.accessTokenName];

        // If no access token, try to refresh using refresh token
        if (!token) {
            const clientRefreshToken = req.cookies[authConfig.cookie.client.refreshTokenName];
            const adminRefreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
            const refreshToken = clientRefreshToken || adminRefreshToken;

            if (!refreshToken) return res.status(401).json({ message: 'No token provided' });

            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            const tokens = await generateTokens(storedToken.userId, storedToken.isAdmin);
            const cookieConfig = storedToken.isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;

            res.cookie(cookieConfig.accessTokenName, tokens.accessToken, {
                ...cookieConfig.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(cookieConfig.refreshTokenName, tokens.refreshToken, {
                ...cookieConfig.options,
                maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
            });

            // Set user info and continue to next middleware
            req.user = { id: storedToken.user.id, username: storedToken.user.username, image: storedToken.user.image || undefined };
            req.isAdmin = storedToken.isAdmin;
            return next();
        }

        if (isTokenBlacklisted(token)) return res.status(401).json({ message: 'Token revoked' });

        try {
            const decoded = jwt.verify(token, authConfig.jwt.secret) as AccessTokenPayload;
            req.user = { id: decoded.id, username: decoded.username, image: decoded.image };
            req.isAdmin = decoded.isAdmin;
            next();
        } catch (error) {
            if (!(error instanceof jwt.TokenExpiredError)) throw error;

            const clientRefreshToken = req.cookies[authConfig.cookie.client.refreshTokenName];
            const adminRefreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
            const refreshToken = clientRefreshToken || adminRefreshToken;

            if (!refreshToken) return res.status(401).json({ message: 'Token expired' });

            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            const tokens = await generateTokens(storedToken.userId, storedToken.isAdmin);
            const cookieConfig = storedToken.isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;

            res.cookie(cookieConfig.accessTokenName, tokens.accessToken, {
                ...cookieConfig.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(cookieConfig.refreshTokenName, tokens.refreshToken, {
                ...cookieConfig.options,
                maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
            });

            // Set user info and continue to next middleware
            req.user = { id: storedToken.user.id, username: storedToken.user.username, image: storedToken.user.image || undefined };
            req.isAdmin = storedToken.isAdmin;
            next();
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};