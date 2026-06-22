import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import {
  calculateRentPerWeek,
  generatePropertyReference,
  normalizeNamePart,
  normalizePhone,
  normalizePostcode,
} from "./normalize";

type DbClient = typeof db & Record<string, any>;

const prisma = db as DbClient;

export type WorkflowCallOutcome = "CONFIRMED" | "FOLLOW_UP" | "NOT_INTERESTED";

export type LandlordLookupOwnership = "OWNED_BY_CURRENT_AGENT" | "OWNED_BY_OTHER_AGENT" | "UNCLAIMED";

export type LookupEventInput = {
  agentId: string;
  phoneNo: string;
  phoneLast10: string;
  phoneE164?: string;
  ownershipState: LandlordLookupOwnership;
  landlordId?: string | null;
  potentialLandlordId?: string | null;
  isLocked?: boolean;
  lockedUntil?: Date | null;
};

export async function createLandlordLookupEvent(input: LookupEventInput) {
  return prisma.landlordLookupEvent.create({
    data: {
      agentId: input.agentId,
      phoneNo: input.phoneNo,
      phoneLast10: input.phoneLast10,
      phoneE164: input.phoneE164 ?? null,
      ownershipState: input.ownershipState,
      landlordId: input.landlordId ?? null,
      potentialLandlordId: input.potentialLandlordId ?? null,
      isLocked: input.isLocked ?? false,
      lockedUntil: input.lockedUntil ?? null,
    },
  });
}

export function reserveFollowUpLock(scheduledAt: Date | string) {
  const followUpAt = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  const lockedUntil = new Date(followUpAt.getTime() + 24 * 60 * 60 * 1000);

  return { followUpAt, lockedUntil };
}

export type WorkflowCallLogInput = {
  agentId: string;
  phoneNo: string;
  outcome: WorkflowCallOutcome;
  notes?: string | null;
  landlordName?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  potentialLandlordId?: string | null;
  scheduledFollowUpAt?: Date | string | null;
};

export async function createWorkflowCallLog(input: WorkflowCallLogInput) {
  const phone = normalizePhone(input.phoneNo);
  const phoneLast10 = phone.ok ? phone.phoneLast10 : input.phoneNo.replace(/\D/g, "").slice(-10);

  const createdAt = new Date();
  const scheduledFollowUpAt =
    input.scheduledFollowUpAt == null
      ? null
      : input.scheduledFollowUpAt instanceof Date
        ? input.scheduledFollowUpAt
        : new Date(input.scheduledFollowUpAt);

  const callRecord = await prisma.callRecord.create({
    data: {
      agentId: input.agentId,
      phoneNumber: input.phoneNo,
      outcome: input.outcome,
      notes: input.notes ?? null,
      landlordName: input.landlordName ?? null,
      convertedToLandlordId: input.landlordId ?? null,
      propertyId: input.propertyId ?? null,
      potentialLandlordId: input.potentialLandlordId ?? null,
      followUpAt: scheduledFollowUpAt,
      createdAt,
    },
  });

  const reportDate = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate()));

  await prisma.dailyReport.upsert({
    where: {
      agentId_reportDate: {
        agentId: input.agentId,
        reportDate,
      },
    },
    create: {
      agentId: input.agentId,
      reportDate,
      callsMade: 1,
      callsConnected: input.outcome === "CONFIRMED" ? 1 : 0,
      callsFailed: input.outcome === "NOT_INTERESTED" ? 1 : 0,
      landlordConfirm: input.outcome === "CONFIRMED" ? 1 : 0,
      followUp: input.outcome === "FOLLOW_UP" ? 1 : 0,
      confirmedCalls: input.outcome === "CONFIRMED" ? 1 : 0,
      followUpCalls: input.outcome === "FOLLOW_UP" ? 1 : 0,
      notInterestedCalls: input.outcome === "NOT_INTERESTED" ? 1 : 0,
      workflowSummary: {
        confirmed: input.outcome === "CONFIRMED" ? 1 : 0,
        followUp: input.outcome === "FOLLOW_UP" ? 1 : 0,
        notInterested: input.outcome === "NOT_INTERESTED" ? 1 : 0,
      },
    } as any,
    update: {
      callsMade: { increment: 1 },
      callsConnected: input.outcome === "CONFIRMED" ? { increment: 1 } : undefined,
      callsFailed: input.outcome === "NOT_INTERESTED" ? { increment: 1 } : undefined,
      landlordConfirm: input.outcome === "CONFIRMED" ? { increment: 1 } : undefined,
      followUp: input.outcome === "FOLLOW_UP" ? { increment: 1 } : undefined,
      confirmedCalls: input.outcome === "CONFIRMED" ? { increment: 1 } : undefined,
      followUpCalls: input.outcome === "FOLLOW_UP" ? { increment: 1 } : undefined,
      notInterestedCalls: input.outcome === "NOT_INTERESTED" ? { increment: 1 } : undefined,
    } as any,
  });

  return callRecord;
}

export type FollowUpLeadInput = {
  agentId: string;
  firstName: string;
  lastName: string;
  phoneNo: string;
  email?: string | null;
  notes?: string | null;
  scheduledAt: Date | string;
};

export async function queueFollowUpReminders(params: {
  agentId: string;
  potentialLandlordId: string;
  contactName: string;
  phoneNo: string;
  scheduledAt: Date;
}) {
  const reminder = await prisma.scheduledCall.create({
    data: {
      agentId: params.agentId,
      phoneNumber: params.phoneNo,
      contactName: params.contactName,
      scheduledAt: params.scheduledAt,
      notes: `Follow-up lead ${params.potentialLandlordId}`,
    },
  });

  await prisma.notification.create({
    data: {
      userId: params.agentId,
      type: "FOLLOW_UP_REMINDER",
      title: `Follow up due for ${params.contactName}`,
      body: `A follow-up call is scheduled for ${params.phoneNo}.`,
      metadata: {
        potentialLandlordId: params.potentialLandlordId,
        scheduledAt: params.scheduledAt.toISOString(),
      },
    },
  });

  return reminder;
}

export async function createFollowUpLead(input: FollowUpLeadInput) {
  const phone = normalizePhone(input.phoneNo);
  if (!phone.ok) {
    throw new Error(phone.message);
  }

  const fullName = `${normalizeNamePart(input.firstName)} ${normalizeNamePart(input.lastName)}`.trim();
  const { followUpAt, lockedUntil } = reserveFollowUpLock(input.scheduledAt);

  const lead = await prisma.potentialLandlord.create({
    data: {
      addedByAgentId: input.agentId,
      fullName,
      phone: input.phoneNo,
      phoneLast10: phone.phoneLast10,
      phoneE164: phone.phoneE164,
      email: input.email ?? null,
      notes: input.notes ?? null,
      followUpScheduledAt: followUpAt,
      followUpLockedUntil: lockedUntil,
      isFollowUpLocked: true,
    },
  });

  await prisma.landlordLookupEvent.create({
    data: {
      agentId: input.agentId,
      phoneNo: input.phoneNo,
      phoneLast10: phone.phoneLast10,
      phoneE164: phone.phoneE164,
      ownershipState: "UNCLAIMED",
      potentialLandlordId: lead.id,
      isLocked: true,
      lockedUntil,
    },
  });

  await queueFollowUpReminders({
    agentId: input.agentId,
    potentialLandlordId: lead.id,
    contactName: fullName,
    phoneNo: phone.phoneE164,
    scheduledAt: followUpAt,
  });

  return { lead, lock: { followUpAt, lockedUntil } };
}

export type InterestedPropertyRoomInput = {
  roomName: string;
  rentPerMonth?: string | number | null;
  rentPerWeek?: string | number | null;
  landlordDemand?: string | number | null;
  expectedCommissionPct?: string | number | null;
};

export type InterestedPropertyPhotoInput = {
  mediaAssetId: string;
  altText?: string | null;
  sortOrder?: number | null;
};

export type InterestedPropertyIntakeInput = {
  agentId: string;
  landlordId?: string | null;
  landlord?: {
    firstName: string;
    lastName: string;
    phoneNo: string;
    email?: string | null;
  } | null;
  property: {
    propertyRef?: string | null;
    title?: string | null;
    description?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    county?: string | null;
    postcode: string;
    propertyCategory?: "PRIVATE" | "SHARED" | null;
    buildingCategory?: "HOUSE" | "FLAT" | "STUDIO_FLAT" | null;
    propertyType?: string | null;
    beds?: number | null;
    baths?: number | null;
    rentPerMonth?: string | number | null;
    rentPerWeek?: string | number | null;
    depositAmount?: string | number | null;
    isFurnished?: boolean | null;
    petsAllowed?: boolean | null;
    dssAllowed?: boolean | null;
    childrenAllowed?: boolean | null;
    availabilityDate?: Date | string | null;
    livingLandlord?: boolean | null;
    publishedToWebsite?: boolean | null;
    rooms?: InterestedPropertyRoomInput[];
    photos?: InterestedPropertyPhotoInput[];
  };
};

// ── Auto-add landlord to Dialer Contacts ────────────────────────────────────
export async function autoAddDialerContact(params: {
  ownerUserId: string;
  fullName: string;
  phoneNumber: string;
  sourceType: "INTERESTED_LANDLORD" | "FOLLOWUP_LANDLORD";
  sourceLandlordId?: string | null;
}) {
  const existing = await prisma.dialerContact.findFirst({
    where: { ownerUserId: params.ownerUserId, phoneNumber: params.phoneNumber },
    select: { id: true },
  });
  if (existing) {
    await prisma.dialerContact.update({
      where: { id: existing.id },
      data: { autoAdded: true, sourceType: params.sourceType, sourceLandlordId: params.sourceLandlordId ?? null },
    });
  } else {
    await prisma.dialerContact.create({
      data: {
        ownerUserId: params.ownerUserId,
        fullName: params.fullName,
        phoneNumber: params.phoneNumber,
        autoAdded: true,
        sourceType: params.sourceType,
        sourceLandlordId: params.sourceLandlordId ?? null,
      } as any,
    });
  }
}

export async function createInterestedPropertyIntake(input: InterestedPropertyIntakeInput) {
  const landlord =
    input.landlordId != null
      ? await prisma.landlord.findUnique({
          where: { id: input.landlordId },
        })
      : null;

  let landlordRecord = landlord;

  if (!landlordRecord) {
    if (!input.landlord) {
      throw new Error("Landlord details are required.");
    }

    const normalizedPhone = normalizePhone(input.landlord.phoneNo);
    if (!normalizedPhone.ok) {
      throw new Error(normalizedPhone.message);
    }

    const firstName = normalizeNamePart(input.landlord.firstName);
    const lastName = normalizeNamePart(input.landlord.lastName);
    const landlordName = `${firstName} ${lastName}`.trim();

    // Check if a landlord with this phone already exists (phoneLast10 is globally unique)
    const existingByPhone = await prisma.landlord.findUnique({
      where: { phoneLast10: normalizedPhone.phoneLast10 },
    });

    if (existingByPhone) {
      landlordRecord = existingByPhone;
    } else {
      landlordRecord = await prisma.landlord.create({
        data: {
          landlordName,
          landlordNumber: input.landlord.phoneNo,
          phoneLast10: normalizedPhone.phoneLast10,
          email: input.landlord.email ?? null,
          createdByUserId: input.agentId,
          updatedByUserId: input.agentId,
          ownerAgentId: input.agentId,
        },
      });
    }
  }

  if (!landlordRecord) {
    throw new Error("Unable to resolve landlord.");
  }

  const propertyRef = input.property.propertyRef?.trim() || generatePropertyReference();
  const postcodeCanonical = normalizePostcode(input.property.postcode);
  const vacancyType = input.property.propertyCategory === "SHARED" ? "MULTIPLE" : "SINGLE";
  const rentPerWeek =
    input.property.rentPerWeek != null
      ? Number(input.property.rentPerWeek).toFixed(2)
      : calculateRentPerWeek(input.property.rentPerMonth) ?? null;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const txAny = tx as any;

    const property = await tx.property.create({
      data: {
        landlordId: landlordRecord.id,
        ownerAgentId: input.agentId,
        propertyRef,
        title: input.property.title ?? null,
        description: input.property.description ?? null,
        addressLine1: input.property.addressLine1 ?? null,
        addressLine2: input.property.addressLine2 ?? null,
        city: input.property.city ?? null,
        county: input.property.county ?? null,
        postcode: postcodeCanonical,
        postcodeCanonical,
        propertyType: input.property.propertyType ?? null,
        beds: input.property.beds ?? null,
        baths: input.property.baths ?? null,
        status: "AVAILABLE",
        vacancyType,
        propertyCategory: (input.property.buildingCategory ?? null) as any,
        rentPerMonth: input.property.rentPerMonth == null ? null : new Prisma.Decimal(input.property.rentPerMonth as any),
        rentPerWeek: rentPerWeek == null ? null : new Prisma.Decimal(rentPerWeek),
        depositAmount: input.property.depositAmount == null ? null : new Prisma.Decimal(input.property.depositAmount as any),
        isFurnished: input.property.isFurnished ?? null,
        petsAllowed: input.property.petsAllowed ?? null,
        dssAllowed: input.property.dssAllowed ?? null,
        childrenAllowed: input.property.childrenAllowed ?? null,
        availabilityDate:
          input.property.availabilityDate == null
            ? null
            : input.property.availabilityDate instanceof Date
              ? input.property.availabilityDate
              : new Date(input.property.availabilityDate),
        livingLandlord: input.property.livingLandlord ?? null,
        publishedToWebsite: input.property.publishedToWebsite ?? false,
      } as any,
    });

    if (vacancyType === "MULTIPLE" && Array.isArray(input.property.rooms) && input.property.rooms.length > 0) {
      await tx.propertyRoom.createMany({
        data: input.property.rooms.map((room, index) => {
          const roomRentPerWeek =
            room.rentPerWeek != null
              ? Number(room.rentPerWeek).toFixed(2)
              : calculateRentPerWeek(room.rentPerMonth) ?? null;

          return {
            propertyId: property.id,
            roomName: room.roomName,
            landlordDemand: room.landlordDemand == null ? null : new Prisma.Decimal(room.landlordDemand as any),
            expectedCommissionPct:
              room.expectedCommissionPct == null ? null : new Prisma.Decimal(room.expectedCommissionPct as any),
            rentPerWeek: roomRentPerWeek == null ? null : new Prisma.Decimal(roomRentPerWeek),
            sortOrder: index,
          } as any;
        }),
      });
    }

    if (Array.isArray(input.property.photos) && input.property.photos.length > 0) {
      await tx.propertyMedia.createMany({
        data: input.property.photos.map((photo, index) => ({
          propertyId: property.id,
          mediaAssetId: photo.mediaAssetId,
          altText: photo.altText ?? null,
          sortOrder: photo.sortOrder ?? index,
        })),
      });
    }

    const callRecord = await tx.callRecord.create({
      data: {
        agentId: input.agentId,
        phoneNumber: landlordRecord.landlordNumber,
        outcome: "CONFIRMED",
        landlordName: landlordRecord.landlordName,
        convertedToLandlordId: landlordRecord.id,
        propertyId: property.id,
      } as any,
    });

    await txAny.landlordLookupEvent.create({
      data: {
        agentId: input.agentId,
        phoneNo: landlordRecord.landlordNumber,
        phoneLast10: landlordRecord.phoneLast10,
        phoneE164: landlordRecord.phoneE164,
        ownershipState: "OWNED_BY_CURRENT_AGENT",
        landlordId: landlordRecord.id,
        isLocked: false,
      },
    });

    return { landlord: landlordRecord, property, callRecord };
  });

  // Auto-add landlord to dialer contacts (outside transaction, non-blocking)
  await autoAddDialerContact({
    ownerUserId: input.agentId,
    fullName: result.landlord.landlordName,
    phoneNumber: result.landlord.landlordNumber,
    sourceType: "INTERESTED_LANDLORD",
    sourceLandlordId: result.landlord.id,
  }).catch(() => {/* non-fatal */});

  return result;
}

export type CloseSaleWithTenantInput = {
  agentId: string;
  propertyId: string;
  roomId?: string | null;
  tenant: {
    fullName: string;
    email?: string | null;
    phoneNo?: string | null;
    phoneE164?: string | null;
    currentAddress?: string | null;
    postcode?: string | null;
    moveInDate?: Date | string | null;
    rentAmount?: string | number | null;
    depositAmount?: string | number | null;
    notes?: string | null;
  };
  sale: {
    finalAmount: string | number;
    commissionPct: string | number;
    commissionAmount: string | number;
    otherCosts?: string | number | null;
    profit: string | number;
  };
};

export async function closeSaleWithTenant(input: CloseSaleWithTenantInput) {
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const sale = await tx.sale.create({
      data: {
        propertyId: input.propertyId,
        roomId: input.roomId ?? null,
        closedByUserId: input.agentId,
        finalAmount: new Prisma.Decimal(input.sale.finalAmount as any),
        commissionPct: new Prisma.Decimal(input.sale.commissionPct as any),
        commissionAmount: new Prisma.Decimal(input.sale.commissionAmount as any),
        otherCosts:
          input.sale.otherCosts == null ? null : new Prisma.Decimal(input.sale.otherCosts as any),
        profit: new Prisma.Decimal(input.sale.profit as any),
      },
    });

    const phone = input.tenant.phoneNo ? normalizePhone(input.tenant.phoneNo) : null;
    const tenant = await tx.tenant.create({
      data: {
        saleId: sale.id,
        addedByAgentId: input.agentId,
        fullName: normalizeNamePart(input.tenant.fullName),
        email: input.tenant.email ?? null,
        phone: input.tenant.phoneNo ?? null,
        phoneE164: phone && phone.ok ? phone.phoneE164 : input.tenant.phoneE164 ?? null,
        phoneLast10: phone && phone.ok ? phone.phoneLast10 : null,
        currentAddress: input.tenant.currentAddress ?? null,
        postcode: input.tenant.postcode ? normalizePostcode(input.tenant.postcode) : null,
        postcodeCanonical: input.tenant.postcode ? normalizePostcode(input.tenant.postcode) : null,
        moveInDate:
          input.tenant.moveInDate == null
            ? null
            : input.tenant.moveInDate instanceof Date
              ? input.tenant.moveInDate
              : new Date(input.tenant.moveInDate),
        rentAmount:
          input.tenant.rentAmount == null ? null : new Prisma.Decimal(input.tenant.rentAmount as any),
        depositAmount:
          input.tenant.depositAmount == null
            ? null
            : new Prisma.Decimal(input.tenant.depositAmount as any),
        notes: input.tenant.notes ?? null,
      } as any,
    });

    return { sale, tenant };
  });

  return result;
}
