/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Plant` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Plant" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[];
