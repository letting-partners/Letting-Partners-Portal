-- AlterTable
ALTER TABLE "DialerDomainConfig"
ADD COLUMN "dialerMode" TEXT NOT NULL DEFAULT 'SIP',
ADD COLUMN "linkusWebClientUrl" TEXT;
