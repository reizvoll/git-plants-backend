import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AccessTokenPayload } from '@/types/auth';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { generateTokens, isTokenBlacklisted } from './authMiddleware';

// client auth middleware
// 1. No access token → 401
// 2. Access token expired → auto refresh (use refresh token)
// 3. Access token valid → continue
export const clientAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check both client and admin tokens
        const token = req.cookies[authConfig.cookie.client.accessTokenName] ||
                     req.cookies[authConfig.cookie.admin.accessTokenName];

        // No access token - return 401
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Check if token is blacklisted
        if (isTokenBlacklisted(token)) {
            return res.status(401).json({ message: 'Token revoked' });
        }

        // Verify access token
        try {
            const decoded = jwt.verify(token, authConfig.jwt.secret) as AccessTokenPayload;
            req.user = { id: decoded.id, username: decoded.username, image: decoded.image };
            req.isAdmin = decoded.isAdmin;
            next();
        } catch (error) {
            // Only auto-refresh when token is expired (not missing)
            if (error instanceof jwt.TokenExpiredError) {
                const clientRefreshToken = req.cookies[authConfig.cookie.client.refreshTokenName];
                const adminRefreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
                const refreshToken = clientRefreshToken || adminRefreshToken;

                if (!refreshToken) {
                    return res.status(401).json({ message: 'Token expired and no refresh token available' });
                }

                // Validate refresh token
                const storedToken = await prisma.refreshToken.findUnique({
                    where: { token: refreshToken },
                    include: { user: true }
                });

                if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
                    return res.status(401).json({ message: 'Invalid or expired refresh token' });
                }

                // Generate new tokens (with family tracking for multi-device support)
                const tokens = await generateTokens(
                    storedToken.userId,
                    storedToken.isAdmin,
                    storedToken.familyId
                );
                const cookieConfig = storedToken.isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;

                // Set new cookies
                res.cookie(cookieConfig.accessTokenName, tokens.accessToken, {
                    ...cookieConfig.options,
                    maxAge: 60 * 60 * 1000 // 1 hour
                });

                res.cookie(cookieConfig.refreshTokenName, tokens.refreshToken, {
                    ...cookieConfig.options,
                    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
                });

                // Set user info and continue
                req.user = { id: storedToken.user.id, username: storedToken.user.username, image: storedToken.user.image || undefined };
                req.isAdmin = storedToken.isAdmin;
                return next();
            }

            // Invalid token (not expired, just invalid)
            return res.status(401).json({ message: 'Invalid token' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Authentication failed' });
    }
};
