-- CreateEnum
CREATE TYPE "DialingArea" AS ENUM ('AREA_1', 'AREA_2', 'AREA_3', 'AREA_4', 'AREA_5');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('LANDLORD', 'PROPERTY', 'TENANT', 'POTENTIAL_TENANT', 'POTENTIAL_LANDLORD');

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "dialingArea" "DialingArea";

-- CreateTable
CREATE TABLE "EditApproval" (
    "id" UUID NOT NULL,
    "entityType" "ApprovalEntityType" NOT NULL,
    "entityId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reviewedById" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "beforeJson" JSONB NOT NULL,
    "proposedJson" JSONB NOT NULL,
    "reviewerNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "EditApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EditApproval_status_createdAt_idx" ON "EditApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EditApproval_entityType_entityId_status_idx" ON "EditApproval"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "EditApproval_requestedById_createdAt_idx" ON "EditApproval"("requestedById", "createdAt");

-- AddForeignKey
ALTER TABLE "EditApproval" ADD CONSTRAINT "EditApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditApproval" ADD CONSTRAINT "EditApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
