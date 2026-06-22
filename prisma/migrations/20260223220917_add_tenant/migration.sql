-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "currentAddress" TEXT,
    "moveInDate" TIMESTAMP(3),
    "rentAmount" DECIMAL(14,2),
    "depositAmount" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_saleId_key" ON "Tenant"("saleId");

-- CreateIndex
CREATE INDEX "Tenant_saleId_idx" ON "Tenant"("saleId");

-- CreateIndex
CREATE INDEX "Tenant_fullName_idx" ON "Tenant"("fullName");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
