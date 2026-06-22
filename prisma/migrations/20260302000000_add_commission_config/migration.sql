-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FIXED', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "CommissionConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "type" "CommissionType" NOT NULL DEFAULT 'FIXED',
    "fixedAmount" DECIMAL(14,2),
    "fixedCurrency" TEXT,
    "flexibleRanges" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "CommissionConfig_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default (Fixed PKR 5000 — matches the previous hardcoded value)
INSERT INTO "CommissionConfig" ("id", "type", "fixedAmount", "fixedCurrency", "updatedAt")
VALUES ('singleton', 'FIXED', 5000, 'PKR', NOW())
ON CONFLICT ("id") DO NOTHING;
