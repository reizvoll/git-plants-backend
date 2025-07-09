import {
  createAdminUser,
  createBadge,
  createGardenItem,
  createMonthlyPlant,
  createUpdateNote,
  deleteAdminUser,
  deleteUpdateNote,
  getAdminSession,
  getAdminStats,
  getAdminUsers,
  getBadges,
  getGardenItems,
  getMonthlyPlants,
  getUpdateNotes,
  updateBadge,
  updateGardenItem,
  updateMonthlyPlant,
  updateUpdateNote
} from '@/controllers/admin/adminController';
import { adminAuth, logout } from '@/middlewares/authMiddleware';
import express from 'express';

const router = express.Router();

// Apply admin authentication middleware to all routes
router.use(adminAuth);

// admin logout
router.post('/signout', logout);

// Check admin session
router.get('/session', getAdminSession);

// Get admin dashboard stats
router.get('/stats', getAdminStats);

// MONTHLY PLANT MANAGEMENT
router.get('/monthly-plants', getMonthlyPlants);
router.post('/monthly-plants', createMonthlyPlant);
router.put('/monthly-plants/:id', updateMonthlyPlant);

// GARDEN ITEM MANAGEMENT
router.get('/items', getGardenItems);
router.post('/items', createGardenItem);
router.put('/items/:id', updateGardenItem);

// BADGE MANAGEMENT
router.get('/badges', getBadges);
router.post('/badges', createBadge);
router.put('/badges/:id', updateBadge);

// UPDATE NOTE MANAGEMENT
router.get('/update-notes', getUpdateNotes);
router.post('/update-notes', createUpdateNote);
router.put('/update-notes/:id', updateUpdateNote);
router.delete('/update-notes/:id', deleteUpdateNote);

// ADMIN USER MANAGEMENT
router.get('/users', getAdminUsers);
router.post('/users', createAdminUser);
router.delete('/users/:id', deleteAdminUser);

export default router; 