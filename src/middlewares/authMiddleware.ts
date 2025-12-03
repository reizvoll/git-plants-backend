import { authConfig } from '@/config/auth';
import prisma from '@/config/db';
import { AccessTokenPayload, TokenResponse, UserPayload } from '@/types/auth';
import crypto from 'crypto';
import { Request, Response } from 'express';
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

// generate tokens with token family tracking (family only)
export const generateTokens = async (
    userId: string,
    isAdmin: boolean = false,
    existingFamilyId?: string
): Promise<TokenResponse> => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, image: true }
    });
    if (!user) throw new Error('User not found');

    // Determine family ID: use existing for token refresh, create new for login
    const familyId = existingFamilyId || crypto.randomBytes(20).toString('hex');

    // Generate tokens
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

    // Create new refresh token with family tracking
    await prisma.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt,
            isAdmin,
            familyId,
        }
    });

    return { accessToken, refreshToken, expiresAt };
};

// logout
export const logout = async (req: Request, res: Response) => {
    try {
        const isAdminRoute = req.path.startsWith('/admin');

        // Check if user is actually an admin by looking at tokens
        const clientAccessToken = req.cookies[authConfig.cookie.client.accessTokenName];
        const adminAccessToken = req.cookies[authConfig.cookie.admin.accessTokenName];

        let userIsAdmin = false;
        if (adminAccessToken) {
            try {
                const decoded = jwt.verify(adminAccessToken, authConfig.jwt.secret) as AccessTokenPayload;
                userIsAdmin = decoded?.isAdmin || false;
            } catch (error) {
                console.log('Failed to verify admin token during logout, treating as non-admin');
                userIsAdmin = false;
            }
        }

        // Blacklist authorization header token if it exists
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, authConfig.jwt.secret) as AccessTokenPayload;
                if (decoded?.exp) {
                    blacklistToken(token, decoded.exp);
                }
            } catch (error) {
                // If verification fails, try to decode to get exp for blacklisting
                try {
                    const decoded = jwt.decode(token) as AccessTokenPayload;
                    if (decoded?.exp) {
                        blacklistToken(token, decoded.exp);
                    }
                } catch {
                    console.log('Failed to process authorization header token during logout');
                }
            }
        }

        // Always clear client tokens
        if (clientAccessToken) {
            try {
                const decoded = jwt.verify(clientAccessToken, authConfig.jwt.secret) as AccessTokenPayload;
                if (decoded?.exp) {
                    blacklistToken(clientAccessToken, decoded.exp);
                }
            } catch (error) {
                // If verification fails, try to decode to get exp for blacklisting
                try {
                    const decoded = jwt.decode(clientAccessToken) as AccessTokenPayload;
                    if (decoded?.exp) {
                        blacklistToken(clientAccessToken, decoded.exp);
                    }
                } catch {
                    console.log('Failed to process client access token during logout');
                }
            }
        }

        // Revoke only the current token family (not all user tokens)
        const clientRefreshToken = req.cookies[authConfig.cookie.client.refreshTokenName];
        if (clientRefreshToken) {
            const storedToken = await prisma.refreshToken.findUnique({
                where: { token: clientRefreshToken },
                select: { familyId: true, userId: true }
            });

            if (storedToken) {
                // Revoke only this family (allows other devices to stay logged in)
                await prisma.refreshToken.updateMany({
                    where: {
                        familyId: storedToken.familyId,
                        userId: storedToken.userId
                    },
                    data: { isRevoked: true }
                });
            }
        }

        // Clear client cookies
        res.clearCookie(authConfig.cookie.client.accessTokenName, authConfig.cookie.client.options);
        res.clearCookie(authConfig.cookie.client.refreshTokenName, authConfig.cookie.client.options);

        // Only clear admin tokens if user is actually an admin
        if (userIsAdmin) {
            if (adminAccessToken) {
                try {
                    const decoded = jwt.verify(adminAccessToken, authConfig.jwt.secret) as AccessTokenPayload;
                    if (decoded?.exp) {
                        blacklistToken(adminAccessToken, decoded.exp);
                    }
                } catch (error) {
                    // If verification fails, try to decode to get exp for blacklisting
                    try {
                        const decoded = jwt.decode(adminAccessToken) as AccessTokenPayload;
                        if (decoded?.exp) {
                            blacklistToken(adminAccessToken, decoded.exp);
                        }
                    } catch {
                        console.log('Failed to process admin access token during logout');
                    }
                }
            }

            const adminRefreshToken = req.cookies[authConfig.cookie.admin.refreshTokenName];
            if (adminRefreshToken) {
                const storedToken = await prisma.refreshToken.findUnique({
                    where: { token: adminRefreshToken },
                    select: { familyId: true, userId: true }
                });

                if (storedToken) {
                    // Revoke only this family
                    await prisma.refreshToken.updateMany({
                        where: {
                            familyId: storedToken.familyId,
                            userId: storedToken.userId
                        },
                        data: { isRevoked: true }
                    });
                }
            }

            // Clear admin cookies
            res.clearCookie(authConfig.cookie.admin.accessTokenName, authConfig.cookie.admin.options);
            res.clearCookie(authConfig.cookie.admin.refreshTokenName, authConfig.cookie.admin.options);
        }

        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({ message: 'Error during logout' });
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