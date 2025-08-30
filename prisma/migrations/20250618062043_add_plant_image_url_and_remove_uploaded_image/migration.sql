/*
  Warnings:

  - You are about to drop the `UploadedImage` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `imageUrl` to the `Plant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "imageUrl" TEXT NOT NULL;

-- DropTable
DROP TABLE "UploadedImage";
