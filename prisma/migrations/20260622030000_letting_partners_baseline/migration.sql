-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('FIXED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'CLOSED');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('HOUSE', 'FLAT', 'STUDIO_FLAT');

-- CreateEnum
CREATE TYPE "WorkflowCallOutcome" AS ENUM ('CONFIRMED', 'FOLLOW_UP', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "VacancyType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'UNDER_OFFER', 'CLOSED');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INCOMING', 'OUTGOING', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('MISSED', 'RINGING', 'ANSWERED', 'REJECTED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallRecordStatus" AS ENUM ('CONNECTED', 'FAILED', 'NO_ANSWER', 'FOLLOW_UP', 'RESCHEDULED', 'VOICEMAIL');

-- CreateEnum
CREATE TYPE "ScheduledCallStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED', 'MISSED');

-- CreateEnum
CREATE TYPE "DialingArea" AS ENUM ('AREA_1', 'AREA_2', 'AREA_3', 'AREA_4', 'AREA_5');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('PRIVATE', 'SHARED');

-- CreateEnum
CREATE TYPE "LivingRoomType" AS ENUM ('PRIVATE', 'SHARED', 'NONE');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('STUDIO_ROOM', 'SINGLE_ROOM', 'DOUBLE_ROOM', 'ENSUITE_ROOM', 'LOFT');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('LANDLORD', 'PROPERTY', 'TENANT', 'POTENTIAL_TENANT', 'POTENTIAL_LANDLORD');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "agentDisplayName" TEXT NOT NULL,
    "profilePicture" TEXT,
    "agentPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landlord" (
    "id" UUID NOT NULL,
    "landlordName" TEXT NOT NULL,
    "landlordNumber" TEXT NOT NULL,
    "phoneE164" TEXT,
    "phoneLast10" TEXT NOT NULL,
    "email" TEXT,
    "notes" TEXT,
    "isPassive" BOOLEAN NOT NULL DEFAULT false,
    "passiveMarkedAt" TIMESTAMP(3),
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
    "title" TEXT,
    "description" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postcode" TEXT,
    "postcodeCanonical" TEXT,
    "propertyType" TEXT,
    "beds" INTEGER,
    "baths" INTEGER,
    "status" "PropertyStatus" NOT NULL DEFAULT 'DRAFT',
    "vacancyType" "VacancyType" NOT NULL DEFAULT 'SINGLE',
    "propertyCategory" "PropertyCategory",
    "isSharedProperty" BOOLEAN NOT NULL DEFAULT false,
    "landlordDemand" DECIMAL(14,2),
    "expectedCommissionPct" DECIMAL(5,2),
    "expectedCommissionAmt" DECIMAL(14,2),
    "totalRooms" INTEGER,
    "availableRooms" INTEGER,
    "rentPerMonth" DECIMAL(14,2),
    "rentPerWeek" DECIMAL(14,2),
    "depositAmount" DECIMAL(14,2),
    "isFurnished" BOOLEAN,
    "personsAllowed" INTEGER,
    "petsAllowed" BOOLEAN,
    "dssAllowed" BOOLEAN,
    "childrenAllowed" BOOLEAN,
    "availabilityDate" TIMESTAMP(3),
    "livingLandlord" BOOLEAN,
    "publishedToWebsite" BOOLEAN NOT NULL DEFAULT false,
    "propType" "PropertyType",
    "garden" BOOLEAN,
    "parking" BOOLEAN,
    "billsIncluded" BOOLEAN,
    "balconyRoofTerrace" BOOLEAN,
    "disabledAccess" BOOLEAN,
    "livingRoom" "LivingRoomType",
    "broadbandIncluded" BOOLEAN,
    "couplesAllowed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "uploadedByUserId" UUID,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyMedia" (
    "propertyId" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "altText" TEXT,

    CONSTRAINT "PropertyMedia_pkey" PRIMARY KEY ("propertyId","mediaAssetId")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "closedByUserId" UUID NOT NULL,
    "finalAmount" DECIMAL(14,2) NOT NULL,
    "commissionPct" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "otherCosts" DECIMAL(14,2),
    "profit" DECIMAL(14,2) NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyRoom" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomName" TEXT NOT NULL,
    "landlordDemand" DECIMAL(14,2),
    "expectedCommissionPct" DECIMAL(5,2),
    "rentPerWeek" DECIMAL(14,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roomType" "RoomType",
    "rentPerMonth" DECIMAL(14,2),
    "depositAmount" DECIMAL(14,2),
    "expectedCommissionAmt" DECIMAL(14,2),

    CONSTRAINT "PropertyRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" UUID NOT NULL,
    "saleId" UUID,
    "addedByAgentId" UUID,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneE164" TEXT,
    "phoneLast10" TEXT,
    "currentAddress" TEXT,
    "postcode" TEXT,
    "postcodeCanonical" TEXT,
    "preferredArea" TEXT,
    "budgetMin" DECIMAL(14,2),
    "budgetMax" DECIMAL(14,2),
    "moveInDate" TIMESTAMP(3),
    "moveInFlexible" BOOLEAN,
    "householdSize" INTEGER,
    "petsAllowed" BOOLEAN,
    "childrenAllowed" BOOLEAN,
    "rentAmount" DECIMAL(14,2),
    "depositAmount" DECIMAL(14,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "accommodationType" TEXT,
    "countryOriginal" TEXT,
    "nationality" TEXT,
    "tenantRoomType" "RoomType",
    "numberOfOccupants" INTEGER,
    "numberOfChildren" INTEGER,
    "onDSS" BOOLEAN,
    "currentlyEmployed" BOOLEAN,
    "annualIncome" DECIMAL(14,2),
    "currentLivingPostcode" TEXT,
    "workplacePostcode" TEXT,
    "maximumBudget" DECIMAL(14,2),
    "workingProfession" TEXT,
    "immigrationStatus" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
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
    "metadata" JSONB,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "fromUserId" UUID NOT NULL,
    "toUserId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

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
    "dialerMode" TEXT NOT NULL DEFAULT 'SIP',
    "linkusWebClientUrl" TEXT,
    "pbxPlatform" TEXT,
    "domain" TEXT,
    "sipPort" INTEGER,
    "sipTransport" TEXT,
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
    "autoAdded" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" TEXT,
    "sourceLandlordId" TEXT,
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

-- CreateTable
CREATE TABLE "PotentialTenant" (
    "id" UUID NOT NULL,
    "addedByAgentId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "phoneLast10" TEXT,
    "phoneE164" TEXT,
    "postcode" TEXT,
    "postcodeCanonical" TEXT,
    "preferredArea" TEXT,
    "interestedIn" TEXT,
    "budget" TEXT,
    "budgetMin" TEXT,
    "budgetMax" TEXT,
    "moveInDate" TIMESTAMP(3),
    "moveInFlexible" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "accommodationType" TEXT,
    "countryOriginal" TEXT,
    "nationality" TEXT,
    "tenantRoomType" "RoomType",
    "numberOfOccupants" INTEGER,
    "numberOfChildren" INTEGER,
    "onDSS" BOOLEAN,
    "currentlyEmployed" BOOLEAN,
    "annualIncome" DECIMAL(14,2),
    "currentLivingPostcode" TEXT,
    "workplacePostcode" TEXT,
    "maximumBudget" DECIMAL(14,2),
    "workingProfession" TEXT,
    "immigrationStatus" TEXT,

    CONSTRAINT "PotentialTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PotentialLandlord" (
    "id" UUID NOT NULL,
    "addedByAgentId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneLast10" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "followUpScheduledAt" TIMESTAMP(3),
    "followUpLockedUntil" TIMESTAMP(3),
    "followUpContinuedAt" TIMESTAMP(3),
    "followUpContinuedByUserId" UUID,
    "isFollowUpLocked" BOOLEAN NOT NULL DEFAULT false,
    "email1hSent" BOOLEAN NOT NULL DEFAULT false,
    "email5minSent" BOOLEAN NOT NULL DEFAULT false,
    "notifSent" BOOLEAN NOT NULL DEFAULT false,
    "firstName" TEXT,
    "lastName" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "reminder1hSent" BOOLEAN NOT NULL DEFAULT false,
    "reminder5mSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PotentialLandlord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandlordLookupEvent" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "phoneNo" TEXT NOT NULL,
    "phoneLast10" TEXT NOT NULL,
    "phoneE164" TEXT,
    "ownershipState" TEXT NOT NULL,
    "landlordId" UUID,
    "potentialLandlordId" UUID,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandlordLookupEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "reportDate" DATE NOT NULL,
    "dialingArea" "DialingArea",
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "callsConnected" INTEGER NOT NULL DEFAULT 0,
    "callsFailed" INTEGER NOT NULL DEFAULT 0,
    "landlordConfirm" INTEGER NOT NULL DEFAULT 0,
    "viewingsArranged" INTEGER NOT NULL DEFAULT 0,
    "successfulViewings" INTEGER NOT NULL DEFAULT 0,
    "followUp" INTEGER NOT NULL DEFAULT 0,
    "confirmedCalls" INTEGER NOT NULL DEFAULT 0,
    "followUpCalls" INTEGER NOT NULL DEFAULT 0,
    "notInterestedCalls" INTEGER NOT NULL DEFAULT 0,
    "lookupEvents" INTEGER NOT NULL DEFAULT 0,
    "propertiesCreated" INTEGER NOT NULL DEFAULT 0,
    "tenantsCreated" INTEGER NOT NULL DEFAULT 0,
    "workflowSummary" JSONB,
    "reSchedule" INTEGER NOT NULL DEFAULT 0,
    "salesClosed" INTEGER NOT NULL DEFAULT 0,
    "totalSearched" INTEGER NOT NULL DEFAULT 0,
    "propertiesConfirmed" INTEGER NOT NULL DEFAULT 0,
    "notInterested" INTEGER NOT NULL DEFAULT 0,
    "potentialTenants" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "CallRecord" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "phoneLast10" TEXT,
    "phoneE164" TEXT,
    "status" "CallRecordStatus" NOT NULL DEFAULT 'CONNECTED',
    "outcome" "WorkflowCallOutcome",
    "landlordName" TEXT,
    "followUpAt" TIMESTAMP(3),
    "propertyId" UUID,
    "potentialLandlordId" UUID,
    "notes" TEXT,
    "convertedToLandlordId" UUID,
    "convertedToTenantId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "CallLog" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "outcome" TEXT,
    "notes" TEXT,
    "phoneLast10" TEXT,
    "landlordFirstName" TEXT,
    "landlordLastName" TEXT,
    "potentialLandlordId" UUID,
    "status" TEXT,
    "followUpScheduledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandlordLookupLog" (
    "id" UUID NOT NULL,
    "agentId" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneLast10" TEXT,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandlordLookupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_agentDisplayName_idx" ON "User"("agentDisplayName");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Landlord_phoneLast10_key" ON "Landlord"("phoneLast10");

-- CreateIndex
CREATE INDEX "Landlord_landlordName_idx" ON "Landlord"("landlordName");

-- CreateIndex
CREATE INDEX "Landlord_landlordNumber_idx" ON "Landlord"("landlordNumber");

-- CreateIndex
CREATE INDEX "Landlord_ownerAgentId_idx" ON "Landlord"("ownerAgentId");

-- CreateIndex
CREATE INDEX "Landlord_ownerAgentId_createdAt_idx" ON "Landlord"("ownerAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "Landlord_createdAt_idx" ON "Landlord"("createdAt");

-- CreateIndex
CREATE INDEX "Property_landlordId_idx" ON "Property"("landlordId");

-- CreateIndex
CREATE INDEX "Property_ownerAgentId_idx" ON "Property"("ownerAgentId");

-- CreateIndex
CREATE INDEX "Property_propertyRef_idx" ON "Property"("propertyRef");

-- CreateIndex
CREATE INDEX "Property_status_idx" ON "Property"("status");

-- CreateIndex
CREATE INDEX "Property_city_idx" ON "Property"("city");

-- CreateIndex
CREATE INDEX "Property_postcode_idx" ON "Property"("postcode");

-- CreateIndex
CREATE INDEX "Property_postcodeCanonical_idx" ON "Property"("postcodeCanonical");

-- CreateIndex
CREATE INDEX "Property_createdAt_idx" ON "Property"("createdAt");

-- CreateIndex
CREATE INDEX "Property_ownerAgentId_createdAt_idx" ON "Property"("ownerAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "Property_landlordId_createdAt_idx" ON "Property"("landlordId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadedByUserId_createdAt_idx" ON "MediaAsset"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE INDEX "PropertyMedia_mediaAssetId_idx" ON "PropertyMedia"("mediaAssetId");

-- CreateIndex
CREATE INDEX "PropertyMedia_propertyId_sortOrder_idx" ON "PropertyMedia"("propertyId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_roomId_key" ON "Sale"("roomId");

-- CreateIndex
CREATE INDEX "Sale_propertyId_idx" ON "Sale"("propertyId");

-- CreateIndex
CREATE INDEX "Sale_closedByUserId_idx" ON "Sale"("closedByUserId");

-- CreateIndex
CREATE INDEX "Sale_closedAt_idx" ON "Sale"("closedAt");

-- CreateIndex
CREATE INDEX "PropertyRoom_propertyId_idx" ON "PropertyRoom"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_saleId_key" ON "Tenant"("saleId");

-- CreateIndex
CREATE INDEX "Tenant_saleId_idx" ON "Tenant"("saleId");

-- CreateIndex
CREATE INDEX "Tenant_fullName_idx" ON "Tenant"("fullName");

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE INDEX "Tenant_phoneLast10_idx" ON "Tenant"("phoneLast10");

-- CreateIndex
CREATE INDEX "Tenant_postcodeCanonical_idx" ON "Tenant"("postcodeCanonical");

-- CreateIndex
CREATE INDEX "Tenant_addedByAgentId_idx" ON "Tenant"("addedByAgentId");

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

-- CreateIndex
CREATE INDEX "ChatMessage_fromUserId_toUserId_createdAt_idx" ON "ChatMessage"("fromUserId", "toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_toUserId_fromUserId_createdAt_idx" ON "ChatMessage"("toUserId", "fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDialerSetting_userId_key" ON "AgentDialerSetting"("userId");

-- CreateIndex
CREATE INDEX "AgentDialerSetting_extensionNumber_idx" ON "AgentDialerSetting"("extensionNumber");

-- CreateIndex
CREATE INDEX "DialerContactLabel_ownerUserId_createdAt_idx" ON "DialerContactLabel"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DialerContactLabel_ownerUserId_name_key" ON "DialerContactLabel"("ownerUserId", "name");

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

-- CreateIndex
CREATE INDEX "PotentialTenant_addedByAgentId_createdAt_idx" ON "PotentialTenant"("addedByAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "PotentialTenant_createdAt_idx" ON "PotentialTenant"("createdAt");

-- CreateIndex
CREATE INDEX "PotentialTenant_fullName_idx" ON "PotentialTenant"("fullName");

-- CreateIndex
CREATE INDEX "PotentialTenant_phoneLast10_idx" ON "PotentialTenant"("phoneLast10");

-- CreateIndex
CREATE INDEX "PotentialLandlord_addedByAgentId_createdAt_idx" ON "PotentialLandlord"("addedByAgentId", "createdAt");

-- CreateIndex
CREATE INDEX "PotentialLandlord_createdAt_idx" ON "PotentialLandlord"("createdAt");

-- CreateIndex
CREATE INDEX "PotentialLandlord_phoneLast10_idx" ON "PotentialLandlord"("phoneLast10");

-- CreateIndex
CREATE INDEX "LandlordLookupEvent_agentId_createdAt_idx" ON "LandlordLookupEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "LandlordLookupEvent_phoneLast10_idx" ON "LandlordLookupEvent"("phoneLast10");

-- CreateIndex
CREATE INDEX "LandlordLookupEvent_landlordId_idx" ON "LandlordLookupEvent"("landlordId");

-- CreateIndex
CREATE INDEX "LandlordLookupEvent_potentialLandlordId_idx" ON "LandlordLookupEvent"("potentialLandlordId");

-- CreateIndex
CREATE INDEX "DailyReport_agentId_reportDate_idx" ON "DailyReport"("agentId", "reportDate");

-- CreateIndex
CREATE INDEX "DailyReport_reportDate_idx" ON "DailyReport"("reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_agentId_reportDate_key" ON "DailyReport"("agentId", "reportDate");

-- CreateIndex
CREATE INDEX "EditApproval_status_createdAt_idx" ON "EditApproval"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EditApproval_entityType_entityId_status_idx" ON "EditApproval"("entityType", "entityId", "status");

-- CreateIndex
CREATE INDEX "EditApproval_requestedById_createdAt_idx" ON "EditApproval"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "CallRecord_agentId_createdAt_idx" ON "CallRecord"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "CallRecord_createdAt_idx" ON "CallRecord"("createdAt");

-- CreateIndex
CREATE INDEX "CallRecord_phoneNumber_idx" ON "CallRecord"("phoneNumber");

-- CreateIndex
CREATE INDEX "CallRecord_propertyId_idx" ON "CallRecord"("propertyId");

-- CreateIndex
CREATE INDEX "CallRecord_potentialLandlordId_idx" ON "CallRecord"("potentialLandlordId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

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
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landlord" ADD CONSTRAINT "Landlord_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerAgentId_fkey" FOREIGN KEY ("ownerAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyMedia" ADD CONSTRAINT "PropertyMedia_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "PropertyRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyRoom" ADD CONSTRAINT "PropertyRoom_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_addedByAgentId_fkey" FOREIGN KEY ("addedByAgentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OTPCode" ADD CONSTRAINT "OTPCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "PotentialTenant" ADD CONSTRAINT "PotentialTenant_addedByAgentId_fkey" FOREIGN KEY ("addedByAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialLandlord" ADD CONSTRAINT "PotentialLandlord_addedByAgentId_fkey" FOREIGN KEY ("addedByAgentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PotentialLandlord" ADD CONSTRAINT "PotentialLandlord_followUpContinuedByUserId_fkey" FOREIGN KEY ("followUpContinuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordLookupEvent" ADD CONSTRAINT "LandlordLookupEvent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordLookupEvent" ADD CONSTRAINT "LandlordLookupEvent_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "Landlord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandlordLookupEvent" ADD CONSTRAINT "LandlordLookupEvent_potentialLandlordId_fkey" FOREIGN KEY ("potentialLandlordId") REFERENCES "PotentialLandlord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditApproval" ADD CONSTRAINT "EditApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditApproval" ADD CONSTRAINT "EditApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_convertedToLandlordId_fkey" FOREIGN KEY ("convertedToLandlordId") REFERENCES "Landlord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRecord" ADD CONSTRAINT "CallRecord_convertedToTenantId_fkey" FOREIGN KEY ("convertedToTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledCall" ADD CONSTRAINT "ScheduledCall_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentNote" ADD CONSTRAINT "AgentNote_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionConfig" ADD CONSTRAINT "CommissionConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed singleton defaults used by the portal settings screens.
INSERT INTO "DialerDomainConfig" ("id", "isEnabled", "updatedAt")
VALUES ('singleton', true, NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CommissionConfig" ("id", "type", "fixedAmount", "fixedCurrency", "updatedAt")
VALUES ('singleton', 'FIXED', 5000, 'PKR', NOW())
ON CONFLICT ("id") DO NOTHING;

