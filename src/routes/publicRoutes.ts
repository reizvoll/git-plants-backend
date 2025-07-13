import { getCurrentUpdateNote, getMonthlyPlants } from '@/controllers/item/gardenController';
import express from 'express';

const router = express.Router();

// 당월 월간 식물 소개 노트 (소개페이지용)
router.get('/monthly-plant', getMonthlyPlants);

// 현재 월의 업데이트 노트와 신규 아이템 (상점페이지용)
router.get('/current-update', getCurrentUpdateNote);

export default router; 