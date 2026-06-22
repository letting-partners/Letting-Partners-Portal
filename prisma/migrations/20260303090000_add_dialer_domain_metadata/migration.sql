-- AlterTable
ALTER TABLE "DialerDomainConfig"
ADD COLUMN "pbxPlatform" TEXT,
ADD COLUMN "sipPort" INTEGER,
ADD COLUMN "sipTransport" TEXT;
