import rateLimit from 'express-rate-limit';

// auto sync settings rate limiter
export const autoSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 requests per IP
  message: {
    message: 'Too many auto sync settings changes, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
}); 