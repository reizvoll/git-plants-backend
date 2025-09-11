-- CreateTable
CREATE TABLE "public"."Translation" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Translation_entityType_entityId_language_idx" ON "public"."Translation"("entityType", "entityId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_entityType_entityId_field_language_key" ON "public"."Translation"("entityType", "entityId", "field", "language");
