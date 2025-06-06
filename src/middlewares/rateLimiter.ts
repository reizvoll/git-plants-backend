import rateLimit from 'express-rate-limit';

// auto sync settings rate limiter
export const autoSyncLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 5, // max 5 requests per IP
  message: {
    message: 'Too many auto sync settings changes, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// limit for api requests
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 200, // 200 requests per min
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// limit for login attempts
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5, // 5 attempts per 15 min
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// limit for specific ip requests
export const ipLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hr
  max: 1000, // 1000 requests per hr
  message: 'IP request limit exceeded',
  standardHeaders: true,
  legacyHeaders: false,
});
