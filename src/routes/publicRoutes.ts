import { getCurrentUpdateNote, getMonthlyPlants, getGardenItems } from '@/controllers/item/gardenController';
import { getPublicUserProfile } from '@/controllers/auth/userController';
import express from 'express';

const router = express.Router();

// 당월 월간 식물 소개 노트 (소개페이지용)
router.get('/monthly-plant', getMonthlyPlants);

// 현재 월의 업데이트 노트와 신규 아이템 (상점페이지용)
router.get('/current-update', getCurrentUpdateNote);

// 모든 garden 아이템 조회 (상점페이지용)
router.get('/items', getGardenItems);

// 공개 유저 프로필 (리드미용)
router.get('/profile/:username', getPublicUserProfile);

export default router; 