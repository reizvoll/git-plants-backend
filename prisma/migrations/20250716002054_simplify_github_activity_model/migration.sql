/*
  Warnings:

  - You are about to drop the column `contributionCount` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `repository` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `GitHubActivity` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `GitHubActivity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,date]` on the table `GitHubActivity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `count` to the `GitHubActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `GitHubActivity` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GitHubActivity_eventId_key";

-- AlterTable
ALTER TABLE "GitHubActivity" DROP COLUMN "contributionCount",
DROP COLUMN "createdAt",
DROP COLUMN "description",
DROP COLUMN "eventId",
DROP COLUMN "repository",
DROP COLUMN "title",
DROP COLUMN "type",
DROP COLUMN "url",
ADD COLUMN     "count" INTEGER NOT NULL,
ADD COLUMN     "date" DATE NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "GitHubActivity_userId_date_key" ON "GitHubActivity"("userId", "date");
