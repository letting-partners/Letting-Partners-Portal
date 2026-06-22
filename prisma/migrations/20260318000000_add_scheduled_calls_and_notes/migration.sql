-- CreateEnum
CREATE TYPE "ScheduledCallStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED', 'MISSED');

-- CreateTable
CREATE TABLE "ScheduledCall" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "contactName" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" "ScheduledCallStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNote" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledCall_agentId_scheduledAt_idx" ON "ScheduledCall"("agentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledCall_scheduledAt_idx" ON "ScheduledCall"("scheduledAt");

-- CreateIndex
CREATE INDEX "ScheduledCall_agentId_status_idx" ON "ScheduledCall"("agentId", "status");

-- CreateIndex
CREATE INDEX "AgentNote_agentId_createdAt_idx" ON "AgentNote"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentNote_agentId_isPinned_idx" ON "AgentNote"("agentId", "isPinned");

-- AddForeignKey
ALTER TABLE "ScheduledCall" ADD CONSTRAINT "ScheduledCall_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNote" ADD CONSTRAINT "AgentNote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
