/*
  Warnings:

  - Added the required column `familyId` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- Delete existing refresh tokens before adding NOT NULL column
DELETE FROM "public"."RefreshToken";

-- AlterTable
ALTER TABLE "public"."RefreshToken" ADD COLUMN     "familyId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "public"."RefreshToken"("familyId");
