/*
  Warnings:

  - Added the required column `cropImageUrl` to the `MonthlyPlant` table without a default value. This is not possible if the table is not empty.
  - Made the column `iconUrl` on table `MonthlyPlant` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MonthlyPlant" ADD COLUMN     "cropImageUrl" TEXT NOT NULL,
ALTER COLUMN "iconUrl" SET NOT NULL;

-- CreateTable
CREATE TABLE "UserCrop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyPlantId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCrop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCrop_userId_idx" ON "UserCrop"("userId");

-- CreateIndex
CREATE INDEX "UserCrop_monthlyPlantId_idx" ON "UserCrop"("monthlyPlantId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCrop_userId_monthlyPlantId_key" ON "UserCrop"("userId", "monthlyPlantId");

-- AddForeignKey
ALTER TABLE "UserCrop" ADD CONSTRAINT "UserCrop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCrop" ADD CONSTRAINT "UserCrop_monthlyPlantId_fkey" FOREIGN KEY ("monthlyPlantId") REFERENCES "MonthlyPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
