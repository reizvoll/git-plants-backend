import {
    equipItem,
    getBadges,
    getGardenItemById,
    getGardenItems,
    getMonthlyPlants,
    getUserBadges,
    getUserItems,
    getUserCrops,
    purchaseItem,
    sellCrops
} from '@/controllers/item/gardenController';
import { clientAuth } from '@/middlewares/authMiddleware';
import express from 'express';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(clientAuth);

// GARDEN ITEMS

// Get all available garden items
router.get('/items', getGardenItems);

// Get garden item by ID
router.get('/items/:id', getGardenItemById);

// USER ITEMS

// Get user's items
router.get('/user-items', getUserItems);

// Get user's crops specifically
router.get('/user-crops', getUserCrops);

// Sell crops for seeds
router.post('/user-crops/sell', sellCrops);

// Purchase item for user
router.post('/user-items', purchaseItem);

// Equip/unequip user item
router.put('/user-items/:id', equipItem);

// BADGES

// Get all available badges
router.get('/badges', getBadges);

// Get user's badges
router.get('/user-badges', getUserBadges);

// MONTHLY PLANTS

// Get monthly plant showcase
router.get('/monthly-plants', getMonthlyPlants);

export default router; 