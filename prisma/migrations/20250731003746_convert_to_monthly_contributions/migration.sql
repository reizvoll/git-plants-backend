/*
  Warnings:

  - You are about to drop the column `date` on the `GitHubActivity` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,month,year]` on the table `GitHubActivity` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `month` to the `GitHubActivity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `GitHubActivity` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "GitHubActivity_userId_date_key";

-- DropIndex
DROP INDEX "GitHubActivity_userId_idx";

-- AlterTable
ALTER TABLE "GitHubActivity" DROP COLUMN "date",
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "GitHubActivity_userId_year_month_idx" ON "GitHubActivity"("userId", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubActivity_userId_month_year_key" ON "GitHubActivity"("userId", "month", "year");
