/*
  Warnings:

  - Added the required column `iconUrl` to the `GardenItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GardenItem" ADD COLUMN     "iconUrl" TEXT NOT NULL;
