import { createAdminUser, deleteAdminUser, getAdminSession, getAdminStats, getAdminUsers } from '@/controllers/admin/adminController';
import { createBadge, createGardenItem, deleteBadge, deleteGardenItem, getBadges, getGardenItemById, getGardenItems, updateBadge, updateGardenItem } from '@/controllers/admin/itemController';
import { createMonthlyPlant, deleteMonthlyPlant, getMonthlyPlantById, getMonthlyPlants, updateMonthlyPlant } from '@/controllers/admin/monthlyPlantController';
import { createUpdateNote, deleteUpdateNote, getUpdateNoteById, getUpdateNotes, updateUpdateNote } from '@/controllers/admin/updateNoteController';
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
router.get('/monthly-plants/:id', getMonthlyPlantById);
router.post('/monthly-plants', createMonthlyPlant);
router.put('/monthly-plants/:id', updateMonthlyPlant);
router.delete('/monthly-plants/:id', deleteMonthlyPlant);

// GARDEN ITEM MANAGEMENT
router.get('/items', getGardenItems);
router.get('/items/:id', getGardenItemById);
router.post('/items', createGardenItem);
router.put('/items/:id', updateGardenItem);
router.delete('/items/:id', deleteGardenItem);

// BADGE MANAGEMENT
router.get('/badges', getBadges);
router.post('/badges', createBadge);
router.put('/badges/:id', updateBadge);
router.delete('/badges/:id', deleteBadge);

// UPDATE NOTE MANAGEMENT
router.get('/update-notes', getUpdateNotes);
router.get('/update-notes/:id', getUpdateNoteById);
router.post('/update-notes', createUpdateNote);
router.put('/update-notes/:id', updateUpdateNote);
router.delete('/update-notes/:id', deleteUpdateNote);

// ADMIN USER MANAGEMENT
router.get('/users', getAdminUsers);
router.post('/users', createAdminUser);
router.delete('/users/:id', deleteAdminUser);

export default router; 