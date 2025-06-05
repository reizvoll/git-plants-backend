/*
  Warnings:

  - You are about to drop the column `role` on the `SuperUser` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SuperUser" DROP COLUMN "role";

-- DropEnum
DROP TYPE "AdminRole";
