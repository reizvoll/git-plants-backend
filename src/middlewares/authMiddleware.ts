import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AccessTokenPayload, TokenResponse, UserPayload } from '@/types/auth';
import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { SuperUser } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
            isAdmin?: boolean;
            superUser?: SuperUser;
        }
    }
}

// token management
const blacklist = new Map<string, number>();
setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    for (const [token, expiresAt] of blacklist.entries()) {
        if (expiresAt < now) blacklist.delete(token);
    }
}, 60 * 60 * 1000);

export const blacklistToken = (token: string, expiresAt: number) => blacklist.set(token, expiresAt);
export const isTokenBlacklisted = (token: string): boolean => blacklist.has(token);

// Cleanup expired refresh tokens
const cleanupExpiredTokens = async () => {
    try {
        await prisma.refreshToken.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { isRevoked: true }
                ]
            }
        });
    } catch (error) {
        console.error('Error cleaning up expired tokens:', error);
    }
};

// Run cleanup every hour
setInterval(cleanupExpiredTokens, 60 * 60 * 1000);

// generate tokens
export const generateTokens = async (userId: string, isAdmin: boolean = false): Promise<TokenResponse> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, image: true }
    });
    if (!user) throw new Error('User not found');

    // Revoke all existing refresh tokens for this user
    await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true }
    });

    const accessToken = jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            image: user.image || undefined,
            isAdmin 
        },
        authConfig.jwt.secret,
        { expiresIn: authConfig.jwt.accessTokenExpiresIn }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { 
            token: refreshToken, 
            userId: user.id, 
            expiresAt,
            isAdmin 
        }
    });

    return { accessToken, refreshToken, expiresAt };
};

// logout
export const logout = async (req: Request, res: Response) => {
    try {
        const isAdmin = req.path.startsWith('/admin');
        const cookieConfig = isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;
        
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.decode(token) as AccessTokenPayload;
            if (decoded?.exp) {
                blacklistToken(token, decoded.exp);
            }
        }
        
        const refreshToken = req.cookies[cookieConfig.refreshTokenName];
        if (refreshToken) {
            await prisma.refreshToken.updateMany({
                where: { token: refreshToken },
                data: { isRevoked: true }
            });
        }

        // Clear cookies
        res.clearCookie(cookieConfig.accessTokenName, cookieConfig.options);
        res.clearCookie(cookieConfig.refreshTokenName, cookieConfig.options);

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ message: 'Error during logout' });
    }
};

// client auth middleware
export const clientAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Check both client and admin tokens
        const token = req.cookies[authConfig.cookie.client.accessTokenName] || 
                     req.cookies[authConfig.cookie.admin.accessTokenName];
        
        if (!token) return res.status(401).json({ message: 'No token provided' });
        if (isTokenBlacklisted(token)) return res.status(401).json({ message: 'Token revoked' });

        try {
            const decoded = jwt.verify(token, authConfig.jwt.secret) as AccessTokenPayload;
            req.user = { id: decoded.id, username: decoded.username, image: decoded.image };
            req.isAdmin = decoded.isAdmin;
            next();
        } catch (error) {
            if (!(error instanceof jwt.TokenExpiredError)) throw error;

            const isAdmin = req.cookies[authConfig.cookie.admin.accessTokenName] !== undefined;
            const cookieConfig = isAdmin ? authConfig.cookie.admin : authConfig.cookie.client;
            const refreshToken = req.cookies[cookieConfig.refreshTokenName];

            if (!refreshToken) return res.status(401).json({ message: 'Token expired' });

            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
                include: { user: true }
            });

            if (!storedToken || storedToken.expiresAt < new Date() || storedToken.isRevoked) {
                return res.status(401).json({ message: 'Invalid refresh token' });
            }

            const tokens = await generateTokens(storedToken.userId, storedToken.isAdmin);
            
            res.cookie(cookieConfig.accessTokenName, tokens.accessToken, {
                ...cookieConfig.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(cookieConfig.refreshTokenName, tokens.refreshToken, {
                ...cookieConfig.options,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            return res.status(200).json({ message: 'Token refreshed' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// admin auth middleware
export const adminAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.cookies[authConfig.cookie.admin.accessTokenName];
        if (!token) return res.status(401).json({ message: 'No token provided' });
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

            const tokens = await generateTokens(storedToken.userId, true);
            
            res.cookie(authConfig.cookie.admin.accessTokenName, tokens.accessToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 60 * 60 * 1000 // 1 hour
            });

            res.cookie(authConfig.cookie.admin.refreshTokenName, tokens.refreshToken, {
                ...authConfig.cookie.admin.options,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            return res.status(200).json({ message: 'Token refreshed' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// revoke all refresh tokens
export const revokeAllRefreshTokens = async (userId: string) => {
    try {
        await prisma.refreshToken.updateMany({
            where: { userId },
            data: { isRevoked: true }
        });
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { refreshTokens: true }
        });

        if (user) {
            for (const refreshToken of user.refreshTokens) {
                const decoded = jwt.decode(refreshToken.token) as AccessTokenPayload;
                if (decoded?.exp) {
                    blacklistToken(refreshToken.token, decoded.exp);
                }
            }
        }

        return true;
    } catch (error) {
        console.error('Error revoking refresh tokens:', error);
        throw error;
    }
};