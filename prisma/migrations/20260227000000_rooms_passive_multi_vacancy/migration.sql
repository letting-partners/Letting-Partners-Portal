-- AlterTable: Add isPassive and passiveMarkedAt to Landlord (idempotent)
ALTER TABLE "Landlord" ADD COLUMN IF NOT EXISTS "isPassive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Landlord" ADD COLUMN IF NOT EXISTS "passiveMarkedAt" TIMESTAMP(3);

-- CreateEnum: VacancyType (idempotent)
DO $$ BEGIN
  CREATE TYPE "VacancyType" AS ENUM ('SINGLE', 'MULTIPLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: RoomStatus (idempotent)
DO $$ BEGIN
  CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: Add vacancyType to Property (idempotent)
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "vacancyType" "VacancyType" NOT NULL DEFAULT 'SINGLE';

-- AlterTable: Sale - remove unique on propertyId if it exists (idempotent)
ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS "Sale_propertyId_key";

-- AlterTable: Sale - add roomId column (idempotent)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "roomId" UUID;

-- Indexes (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_roomId_key" ON "Sale"("roomId") WHERE "roomId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Sale_propertyId_idx" ON "Sale"("propertyId");

-- CreateTable: PropertyRoom (idempotent)
CREATE TABLE IF NOT EXISTS "PropertyRoom" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "propertyId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "landlordDemand" DECIMAL(14,2),
    "expectedCommissionPct" DECIMAL(5,2),
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PropertyRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "PropertyRoom_propertyId_idx" ON "PropertyRoom"("propertyId");

-- AddForeignKey: PropertyRoom -> Property (idempotent)
DO $$ BEGIN
  ALTER TABLE "PropertyRoom" ADD CONSTRAINT "PropertyRoom_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: Sale -> PropertyRoom (idempotent)
DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
