-- CreateTable
CREATE TABLE "PotentialLandlord" (
    "id" UUID NOT NULL,
    "addedByAgentId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneLast10" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotentialLandlord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PotentialLandlord_addedByAgentId_createdAt_idx" ON "PotentialLandlord"("addedByAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "PotentialLandlord_createdAt_idx" ON "PotentialLandlord"("createdAt");

-- CreateIndex
CREATE INDEX "PotentialLandlord_phoneLast10_idx" ON "PotentialLandlord"("phoneLast10");

-- AddForeignKey
ALTER TABLE "PotentialLandlord" ADD CONSTRAINT "PotentialLandlord_addedByAgentId_fkey" FOREIGN KEY ("addedByAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
