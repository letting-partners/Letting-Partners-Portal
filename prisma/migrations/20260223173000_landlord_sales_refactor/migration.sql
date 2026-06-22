-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'LIVE', 'UNDER_OFFER', 'SOLD', 'WITHDRAWN');

-- DropForeignKey
ALTER TABLE "Property" DROP CONSTRAINT "Property_landlordId_ownerAgentId_fkey";

-- AlterTable
ALTER TABLE "Landlord"
ADD COLUMN     "phoneE164" TEXT,
ADD COLUMN     "phoneLast10" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT;

UPDATE "Landlord"
SET "phoneLast10" = RIGHT(LPAD(REGEXP_REPLACE("landlordNumber", '\D', '', 'g'), 10, '0'), 10)
WHERE "phoneLast10" IS NULL;

ALTER TABLE "Landlord"
ALTER COLUMN "phoneLast10" SET NOT NULL;

ALTER TABLE "Landlord"
DROP COLUMN "propertyId",
DROP COLUMN "url",
DROP COLUMN "status",
DROP COLUMN "lockedAt";

-- AlterTable
ALTER TABLE "Property"
ADD COLUMN     "county" TEXT,
ADD COLUMN     "postcode" TEXT,
ADD COLUMN     "propertyType" TEXT,
ADD COLUMN     "beds" INTEGER,
ADD COLUMN     "baths" INTEGER,
ADD COLUMN     "landlordDemand" DECIMAL(14,2),
ADD COLUMN     "expectedCommissionPct" DECIMAL(5,2),
ADD COLUMN     "status_new" "PropertyStatus" NOT NULL DEFAULT 'DRAFT';

UPDATE "Property"
SET
  "county" = COALESCE("county", "stateRegion"),
  "postcode" = COALESCE("postcode", "postalCode");

UPDATE "Property"
SET "status_new" = CASE
  WHEN UPPER(COALESCE("status", '')) = 'LIVE' THEN 'LIVE'::"PropertyStatus"
  WHEN UPPER(COALESCE("status", '')) = 'UNDER_OFFER' THEN 'UNDER_OFFER'::"PropertyStatus"
  WHEN UPPER(COALESCE("status", '')) = 'SOLD' THEN 'SOLD'::"PropertyStatus"
  WHEN UPPER(COALESCE("status", '')) = 'WITHDRAWN' THEN 'WITHDRAWN'::"PropertyStatus"
  ELSE 'DRAFT'::"PropertyStatus"
END;

ALTER TABLE "Property"
DROP COLUMN "stateRegion",
DROP COLUMN "postalCode",
DROP COLUMN "country",
DROP COLUMN "url",
DROP COLUMN "status";

ALTER TABLE "Property" RENAME COLUMN "status_new" TO "status";

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "closedByUserId" UUID NOT NULL,
    "finalAmount" DECIMAL(14,2) NOT NULL,
    "commissionPct" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "otherCosts" DECIMAL(14,2),
    "profit" DECIMAL(14,2) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX "Landlord_id_ownerAgentId_key";

-- DropIndex
DROP INDEX "Property_landlordId_ownerAgentId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Landlord_phoneLast10_key" ON "Landlord"("phoneLast10");

-- CreateIndex
CREATE INDEX "Property_postcode_idx" ON "Property"("postcode");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_propertyId_key" ON "Sale"("propertyId");

-- CreateIndex
CREATE INDEX "Sale_closedByUserId_idx" ON "Sale"("closedByUserId");

-- CreateIndex
CREATE INDEX "Sale_closedAt_idx" ON "Sale"("closedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropEnum
DROP TYPE "LandlordStatus";
