import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import activityRoutes from './routes/activityRoutes';
import adminRoutes from './routes/adminRoutes';
import authRoutes from './routes/authRoutes';
import gardenRoutes from './routes/gardenRoutes';
import plantRoutes from './routes/plantRoutes';
import seedRoutes from './routes/seedRoutes';
import userRoutes from './routes/userRoutes';

dotenv.config();
const app = express();

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Routes (upcoming)
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/seeds', seedRoutes);
app.use('/api/garden', gardenRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 