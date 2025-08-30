/*
  Warnings:

  - Added the required column `mainImageUrl` to the `MonthlyPlant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MonthlyPlant" ADD COLUMN     "mainImageUrl" TEXT NOT NULL;
