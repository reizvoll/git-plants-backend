/*
  Warnings:

  - You are about to drop the column `month` on the `UpdateNote` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `UpdateNote` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UpdateNote_month_year_key";

-- AlterTable
ALTER TABLE "UpdateNote" DROP COLUMN "month",
DROP COLUMN "year",
ADD COLUMN     "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "UpdateNote_publishedAt_idx" ON "UpdateNote"("publishedAt");

-- CreateIndex
CREATE INDEX "UpdateNote_isActive_idx" ON "UpdateNote"("isActive");
