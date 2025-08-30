/*
  Warnings:

  - You are about to drop the column `currentContributions` on the `UserPlant` table. All the data in the column will be lost.
  - You are about to drop the `GrowthLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GrowthLog" DROP CONSTRAINT "GrowthLog_userPlantId_fkey";

-- AlterTable
ALTER TABLE "UserPlant" DROP COLUMN "currentContributions";

-- DropTable
DROP TABLE "GrowthLog";
