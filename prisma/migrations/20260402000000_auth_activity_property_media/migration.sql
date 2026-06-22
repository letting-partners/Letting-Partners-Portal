-- AlterTable
ALTER TABLE "User"
ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Property"
ADD COLUMN "title" TEXT,
ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "uploadedByUserId" UUID,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "propertyId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("propertyId","mediaAssetId")
);

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedByUserId_createdAt_idx" ON "MediaAsset"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE INDEX "PropertyMedia_mediaAssetId_idx" ON "PropertyMedia"("mediaAssetId");

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyId_sortOrder_idx" ON "PropertyMedia"("propertyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "MediaAsset"
ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia"
ADD CONSTRAINT "PropertyMedia_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia"
ADD CONSTRAINT "PropertyMedia_mediaAssetId_fkey"
FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
