import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AccessTokenPayload } from '@/types/auth';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateTokens, isTokenBlacklisted } from './authMiddleware';

// admin auth middleware
export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies[authConfig.cookie.admin.accessTokenName];

        // If no access token, try to refresh using refresh token
        if (!token) {
            const refreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
            if (!refreshToken) return res.status(401).json({ message: 'No token provided' });

            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked || !storedToken.isAdmin) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            // Verify SuperUser in database for token refresh
            const superUser = await prisma.superUser.findUnique({
                where: { userId: storedToken.userId }
            });

            if (!superUser) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            const tokens = await generateTokens(storedToken.userId, true, storedToken.familyId);

            res.cookie(authConfig.cookie.admin.accessTokenName, tokens.accessToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(authConfig.cookie.admin.refreshTokenName, tokens.refreshToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
            });

            // Set user info and continue to next middleware
            req.user = { id: storedToken.user.id, username: storedToken.user.username, image: storedToken.user.image || undefined };
            req.isAdmin = true;
            req.superUser = superUser;
            return next();
        }

        if (isTokenBlacklisted(token)) return res.status(401).json({ message: 'Token revoked' });

        try {
            const decoded = jwt.verify(token, authConfig.jwt.secret) as AccessTokenPayload;
            if (!decoded.isAdmin) {
                return res.status(403).json({ message: 'Client token not allowed for admin routes' });
            }

            // Verify SuperUser in database
            const superUser = await prisma.superUser.findUnique({
                where: { userId: decoded.id }
            });

            if (!superUser) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            req.user = { id: decoded.id, username: decoded.username, image: decoded.image };
            req.isAdmin = true;
            req.superUser = superUser;
            next();
        } catch (error) {
            if (!(error instanceof jwt.TokenExpiredError)) throw error;

            const refreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
            if (!refreshToken) return res.status(401).json({ message: 'Token expired' });

            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked || !storedToken.isAdmin) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            // Verify SuperUser in database for token refresh
            const superUser = await prisma.superUser.findUnique({
                where: { userId: storedToken.userId }
            });

            if (!superUser) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            const tokens = await generateTokens(storedToken.userId, true, storedToken.familyId);

            res.cookie(authConfig.cookie.admin.accessTokenName, tokens.accessToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(authConfig.cookie.admin.refreshTokenName, tokens.refreshToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 3 * 24 * 60 * 60 * 1000 // 3 days
            });

            // Set user info and continue to next middleware (superUser already validated above)
            req.user = { id: storedToken.user.id, username: storedToken.user.username, image: storedToken.user.image || undefined };
            req.isAdmin = true;
            req.superUser = superUser;
            next();
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};