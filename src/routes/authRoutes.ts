import { githubCallback, startGitHubAuth, startGitHubAuthAdmin } from '@/controllers/auth/githubController';
import { getSession, refreshToken } from '@/controllers/auth/sessionController';
import { logout } from '@/middlewares/authMiddleware';
import { clientAuth } from '@/middlewares/clientAuth';
import { loginLimiter } from '@/middlewares/rateLimiter';
import express from 'express';

const router = express.Router();

// start GitHub OAuth login for client
router.get('/github', loginLimiter, startGitHubAuth);

// start GitHub OAuth login for admin
router.get('/github/admin', loginLimiter, startGitHubAuthAdmin);

// GitHub OAuth callback
router.get('/callback/github', githubCallback);

// check session for client
router.get('/session', clientAuth, getSession);

// logout
router.post('/signout', clientAuth, logout);

// refresh token endpoint
router.post('/refresh', refreshToken);

export default router; 