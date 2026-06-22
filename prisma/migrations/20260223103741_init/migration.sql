-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "LandlordStatus" AS ENUM ('ACTIVE', 'PASSIVE');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "agentDisplayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landlord" (
    "id" UUID NOT NULL,
    "landlordName" TEXT NOT NULL,
    "landlordNumber" TEXT NOT NULL,
    "propertyId" TEXT,
    "url" TEXT,
    "status" "LandlordStatus" NOT NULL DEFAULT 'ACTIVE',
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "ownerAgentId" UUID NOT NULL,

    CONSTRAINT "Landlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "landlordId" UUID NOT NULL,
    "ownerAgentId" UUID NOT NULL,
    "propertyRef" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateRegion" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "url" TEXT,
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OTPCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OTPCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agentDisplayName_idx" ON "User"("agentDisplayName");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "Landlord_landlordName_idx" ON "Landlord"("landlordName");

-- CreateIndex
CREATE INDEX "Landlord_landlordNumber_idx" ON "Landlord"("landlordNumber");

-- CreateIndex
CREATE INDEX "Landlord_status_idx" ON "Landlord"("status");

-- CreateIndex
CREATE INDEX "Landlord_propertyId_idx" ON "Landlord"("propertyId");

-- CreateIndex
CREATE INDEX "Landlord_url_idx" ON "Landlord"("url");

-- CreateIndex
CREATE INDEX "Landlord_ownerAgentId_idx" ON "Landlord"("ownerAgentId");

-- CreateIndex
CREATE INDEX "Landlord_ownerAgentId_status_idx" ON "Landlord"("ownerAgentId", "status");

-- CreateIndex
CREATE INDEX "Landlord_ownerAgentId_createdAt_idx" ON "Landlord"("ownerAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "Landlord_createdAt_idx" ON "Landlord"("createdAt");

-- CreateIndex
CREATE INDEX "Landlord_status_createdAt_idx" ON "Landlord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Landlord_landlordNumber_status_idx" ON "Landlord"("landlordNumber", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Landlord_id_ownerAgentId_key" ON "Landlord"("id", "ownerAgentId");

-- CreateIndex
CREATE INDEX "Property_landlordId_idx" ON "Property"("landlordId");

-- CreateIndex
CREATE INDEX "Property_ownerAgentId_idx" ON "Property"("ownerAgentId");

-- CreateIndex
CREATE INDEX "Property_propertyRef_idx" ON "Property"("propertyRef");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_url_idx" ON "Property"("url");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_postalCode_idx" ON "Property"("postalCode");

-- CreateIndex
CREATE INDEX "Property_landlordId_ownerAgentId_idx" ON "Property"("landlordId", "ownerAgentId");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Property_ownerAgentId_createdAt_idx" ON "Property"("ownerAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "Property_landlordId_createdAt_idx" ON "Property"("landlordId", "createdAt");

-- CreateIndex
CREATE INDEX "OTPCode_userId_createdAt_idx" ON "OTPCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OTPCode_expiresAt_idx" ON "OTPCode"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_ownerAgentId_fkey" FOREIGN KEY ("landlordId", "ownerAgentId") REFERENCES "Landlord"("id", "ownerAgentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTPCode" ADD CONSTRAINT "OTPCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
