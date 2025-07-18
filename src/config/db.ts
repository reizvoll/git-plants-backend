import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const gardenItemSelect = {
  id: true,
  name: true,
  category: true,
  mode: true,
  imageUrl: true,
  iconUrl: true,
  price: true,
  createdAt: true,
  updatedAt: true,
  // updatedById 제외 (관리자용, 추후 별도 정의 예정)
};

export const monthlyPlantSelect = {
  id: true,
  title: true,
  name: true,
  description: true,
  imageUrls: true,
  iconUrl: true,
  month: true,
  year: true,
  createdAt: true,
  updatedAt: true,
  // updatedById 제외
};

export const badgeSelect = {
  id: true,
  name: true,
  condition: true,
  imageUrl: true,
  createdAt: true,
  updatedAt: true,
  // updatedById 제외
};


export default prisma;