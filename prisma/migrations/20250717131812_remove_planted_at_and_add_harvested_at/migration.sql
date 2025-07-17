/*
  Warnings:

  - You are about to drop the column `plantedAt` on the `UserPlant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserPlant" DROP COLUMN "plantedAt",
ADD COLUMN     "harvestedAt" TIMESTAMP(3);
