-- Make saleId optional on Tenant (allow standalone tenants)
ALTER TABLE "Tenant" ALTER COLUMN "saleId" DROP NOT NULL;

-- Add phoneLast10 field to Tenant for uniqueness checks
ALTER TABLE "Tenant" ADD COLUMN "phoneLast10" TEXT;

-- Add addedByAgentId field to Tenant
ALTER TABLE "Tenant" ADD COLUMN "addedByAgentId" UUID;
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_addedByAgentId_fkey"
  FOREIGN KEY ("addedByAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create indexes for the new fields
CREATE INDEX "Tenant_phoneLast10_idx" ON "Tenant"("phoneLast10");
CREATE INDEX "Tenant_addedByAgentId_idx" ON "Tenant"("addedByAgentId");
