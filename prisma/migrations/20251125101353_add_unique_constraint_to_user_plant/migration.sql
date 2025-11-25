/*
  Warnings:

  - A unique constraint covering the columns `[userId,monthlyPlantId]` on the table `UserPlant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserPlant_userId_monthlyPlantId_key" ON "public"."UserPlant"("userId", "monthlyPlantId");
