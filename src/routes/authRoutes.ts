import { githubCallback, startGitHubAuth } from '@/controllers/auth/githubController';
import { getSession, refreshToken } from '@/controllers/auth/sessionController';
import { clientAuth, logout } from '@/middlewares/authMiddleware';
import { loginLimiter } from '@/middlewares/rateLimiter';
import express from 'express';

const router = express.Router();

// start GitHub OAuth login
router.get('/github', loginLimiter, startGitHubAuth);

// GitHub OAuth callback
router.get('/callback/github', githubCallback);

// check session for client
router.get('/session', clientAuth, getSession);

// logout
router.post('/signout', clientAuth, logout);

// refresh token endpoint
router.post('/refresh', refreshToken);

export default router; 