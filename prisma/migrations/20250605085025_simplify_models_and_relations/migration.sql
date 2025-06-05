/*
  Warnings:

  - The primary key for the `Badge` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Badge` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `GardenItem` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `GardenItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `MonthlyPlant` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `MonthlyPlant` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `Seed` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Seed` table. All the data in the column will be lost.
  - You are about to drop the column `obtainedAt` on the `Seed` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Seed` table. All the data in the column will be lost.
  - Changed the type of `badgeId` on the `UserBadge` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `itemId` on the `UserItem` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "UserBadge" DROP CONSTRAINT "UserBadge_badgeId_fkey";

-- DropForeignKey
ALTER TABLE "UserItem" DROP CONSTRAINT "UserItem_itemId_fkey";

-- DropIndex
DROP INDEX "Seed_userId_idx";

-- AlterTable
ALTER TABLE "Badge" DROP CONSTRAINT "Badge_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Badge_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "GardenItem" DROP CONSTRAINT "GardenItem_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "GardenItem_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "MonthlyPlant" DROP CONSTRAINT "MonthlyPlant_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "MonthlyPlant_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Seed" DROP CONSTRAINT "Seed_pkey",
DROP COLUMN "id",
DROP COLUMN "obtainedAt",
DROP COLUMN "type",
ADD COLUMN     "count" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "Seed_pkey" PRIMARY KEY ("userId");

-- AlterTable
ALTER TABLE "UserBadge" DROP COLUMN "badgeId",
ADD COLUMN     "badgeId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "UserItem" DROP COLUMN "itemId",
ADD COLUMN     "itemId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "UserBadge_badgeId_idx" ON "UserBadge"("badgeId");

-- CreateIndex
CREATE INDEX "UserItem_itemId_idx" ON "UserItem"("itemId");

-- AddForeignKey
ALTER TABLE "UserItem" ADD CONSTRAINT "UserItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GardenItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
