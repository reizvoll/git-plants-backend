import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Common types
export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const gardenItemSelect = {
  id: true,
  name: true,
  category: true,
  mode: true,
  imageUrl: true,
  iconUrl: true,
  price: true,
};

export const monthlyPlantSelect = {
  id: true,
  title: true,
  name: true,
  description: true,
  mainImageUrl: true,
  imageUrls: true,
  iconUrl: true,
  cropImageUrl: true,
  month: true,
  year: true,
};

export const badgeSelect = {
  id: true,
  name: true,
  condition: true,
  imageUrl: true,
};

export default prisma;