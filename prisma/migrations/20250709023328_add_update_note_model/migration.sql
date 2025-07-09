-- CreateTable
CREATE TABLE "UpdateNote" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "UpdateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GardenItemToUpdateNote" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_GardenItemToUpdateNote_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "UpdateNote_month_year_key" ON "UpdateNote"("month", "year");

-- CreateIndex
CREATE INDEX "_GardenItemToUpdateNote_B_index" ON "_GardenItemToUpdateNote"("B");

-- AddForeignKey
ALTER TABLE "UpdateNote" ADD CONSTRAINT "UpdateNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "SuperUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GardenItemToUpdateNote" ADD CONSTRAINT "_GardenItemToUpdateNote_A_fkey" FOREIGN KEY ("A") REFERENCES "GardenItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GardenItemToUpdateNote" ADD CONSTRAINT "_GardenItemToUpdateNote_B_fkey" FOREIGN KEY ("B") REFERENCES "UpdateNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
