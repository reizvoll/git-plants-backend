/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `UpdateNote` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."UpdateNote" DROP COLUMN "imageUrl",
ADD COLUMN     "imageUrls" TEXT[];
