-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INCOMING', 'OUTGOING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('MISSED', 'RINGING', 'ANSWERED', 'REJECTED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "AgentDialerSetting" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "extensionNumber" TEXT,
    "extensionName" TEXT,
    "providerUsername" TEXT,
    "providerPassword" TEXT,
    "autoDetectExtension" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDialerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialerDomainConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "domain" TEXT,
    "websocketHost" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" UUID,

    CONSTRAINT "DialerDomainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialerContactLabel" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#C9A84C',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialerContactLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialerContact" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "extensionNumber" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialerContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialerContactLabelOnContact" (
    "contactId" UUID NOT NULL,
    "labelId" UUID NOT NULL,

    CONSTRAINT "DialerContactLabelOnContact_pkey" PRIMARY KEY ("contactId","labelId")
);

-- CreateTable
CREATE TABLE "DialerCall" (
    "id" UUID NOT NULL,
    "agentUserId" UUID NOT NULL,
    "counterpartUserId" UUID,
    "contactId" UUID,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "peerName" TEXT,
    "peerNumber" TEXT,
    "peerExtension" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "recordingUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialerCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentDialerSetting_userId_key" ON "AgentDialerSetting"("userId");

-- CreateIndex
CREATE INDEX "AgentDialerSetting_extensionNumber_idx" ON "AgentDialerSetting"("extensionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DialerContactLabel_ownerUserId_name_key" ON "DialerContactLabel"("ownerUserId", "name");

-- CreateIndex
CREATE INDEX "DialerContactLabel_ownerUserId_createdAt_idx" ON "DialerContactLabel"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DialerContact_ownerUserId_createdAt_idx" ON "DialerContact"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "DialerContact_ownerUserId_fullName_idx" ON "DialerContact"("ownerUserId", "fullName");

-- CreateIndex
CREATE INDEX "DialerContact_phoneNumber_idx" ON "DialerContact"("phoneNumber");

-- CreateIndex
CREATE INDEX "DialerContactLabelOnContact_labelId_idx" ON "DialerContactLabelOnContact"("labelId");

-- CreateIndex
CREATE INDEX "DialerCall_agentUserId_startedAt_idx" ON "DialerCall"("agentUserId", "startedAt");

-- CreateIndex
CREATE INDEX "DialerCall_agentUserId_direction_status_idx" ON "DialerCall"("agentUserId", "direction", "status");

-- CreateIndex
CREATE INDEX "DialerCall_counterpartUserId_idx" ON "DialerCall"("counterpartUserId");

-- CreateIndex
CREATE INDEX "DialerCall_contactId_idx" ON "DialerCall"("contactId");

-- AddForeignKey
ALTER TABLE "AgentDialerSetting" ADD CONSTRAINT "AgentDialerSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerDomainConfig" ADD CONSTRAINT "DialerDomainConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerContactLabel" ADD CONSTRAINT "DialerContactLabel_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerContact" ADD CONSTRAINT "DialerContact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerContactLabelOnContact" ADD CONSTRAINT "DialerContactLabelOnContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "DialerContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerContactLabelOnContact" ADD CONSTRAINT "DialerContactLabelOnContact_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "DialerContactLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerCall" ADD CONSTRAINT "DialerCall_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerCall" ADD CONSTRAINT "DialerCall_counterpartUserId_fkey" FOREIGN KEY ("counterpartUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialerCall" ADD CONSTRAINT "DialerCall_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "DialerContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton dialer config row
INSERT INTO "DialerDomainConfig" ("id", "isEnabled", "updatedAt")
VALUES ('singleton', true, NOW())
ON CONFLICT ("id") DO NOTHING;
