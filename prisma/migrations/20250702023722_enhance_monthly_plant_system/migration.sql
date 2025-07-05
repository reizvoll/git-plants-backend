/*
  Warnings:

  - You are about to drop the column `plantId` on the `GrowthLog` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `MonthlyPlant` table. All the data in the column will be lost.
  - You are about to drop the `Plant` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[month,year]` on the table `MonthlyPlant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userPlantId` to the `GrowthLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `MonthlyPlant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GrowthLog" DROP CONSTRAINT "GrowthLog_plantId_fkey";

-- DropForeignKey
ALTER TABLE "Plant" DROP CONSTRAINT "Plant_userId_fkey";

-- DropIndex
DROP INDEX "GrowthLog_plantId_idx";

-- AlterTable
ALTER TABLE "GrowthLog" DROP COLUMN "plantId",
ADD COLUMN     "userPlantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MonthlyPlant" DROP COLUMN "imageUrl",
ADD COLUMN     "iconUrl" TEXT,
ADD COLUMN     "imageUrls" TEXT[],
ADD COLUMN     "name" TEXT NOT NULL;

-- DropTable
DROP TABLE "Plant";

-- CreateTable
CREATE TABLE "UserPlant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyPlantId" INTEGER NOT NULL,
    "stage" "GrowthStage" NOT NULL DEFAULT 'SEED',
    "currentContributions" INTEGER NOT NULL DEFAULT 0,
    "plantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPlant_userId_idx" ON "UserPlant"("userId");

-- CreateIndex
CREATE INDEX "UserPlant_monthlyPlantId_idx" ON "UserPlant"("monthlyPlantId");

-- CreateIndex
CREATE INDEX "GrowthLog_userPlantId_idx" ON "GrowthLog"("userPlantId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyPlant_month_year_key" ON "MonthlyPlant"("month", "year");

-- AddForeignKey
ALTER TABLE "UserPlant" ADD CONSTRAINT "UserPlant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlant" ADD CONSTRAINT "UserPlant_monthlyPlantId_fkey" FOREIGN KEY ("monthlyPlantId") REFERENCES "MonthlyPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthLog" ADD CONSTRAINT "GrowthLog_userPlantId_fkey" FOREIGN KEY ("userPlantId") REFERENCES "UserPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
