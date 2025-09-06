import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { apiLimiter, ipLimiter } from './middlewares/rateLimiter';
import { initRedis, closeRedis } from './config/redis';
import activityRoutes from './routes/activityRoutes';
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';
import gardenRoutes from './routes/gardenRoutes';
import plantRoutes from './routes/plantRoutes';
import seedRoutes from './routes/seedRoutes';
import uploadRoutes from './routes/uploadRoutes';
import userRoutes from './routes/userRoutes';
import publicRoutes from './routes/publicRoutes';

dotenv.config();
const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    process.env.ADMIN_URL
  ].filter((url): url is string => Boolean(url)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'], } ));
app.use(express.json());
app.use(cookieParser());

// Global Rate Limiting
app.use(ipLimiter);
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/seeds', seedRoutes);
app.use('/api/garden', gardenRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/public', publicRoutes);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;
const IS_REDIS_PRODUCTION = process.env.IS_REDIS_PRODUCTION === 'true';

// Redis initialization and server start (in production mode)
async function startServer() {
  try {
    if (IS_REDIS_PRODUCTION) {
      await initRedis();
      
      const server = app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log(`Redis cache enabled for GitHub activities`);
      });

      // Graceful shutdown
      const gracefulShutdown = async (signal: string) => {
        console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
        
        await closeRedis();
        
        server.close(() => {
          console.log('Server closed successfully');
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      
    } else {
      // Redis disabled - simple server start (in dev mode)
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    }
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer(); 