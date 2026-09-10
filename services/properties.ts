import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql as raw, type SQL } from "drizzle-orm";
import { db, executeRows, type Transaction } from "@/db";
import {
  imageAssets,
  landlords,
  properties,
  propertyHistory,
  propertyImages,
  propertyPublications,
  propertyRooms,
  users,
  type commissionTypeEnum,
  type contactSourceEnum,
  type livingRoomEnum,
  type propertyCategoryEnum,
} from "@/db/schema";
import { monthlyToWeeklyPence } from "@/lib/money";
import { formatPostcode, getOutcode, parsePostcode } from "@/lib/postcode";
import { buildPropertySlug, disambiguateSlug } from "@/lib/slug";
import { formatReference, REFERENCE_PREFIX } from "@/lib/reference";
import { ENTITY, recordActivity, recordAudit } from "./audit";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, truncateAtWord } from "./listing-seo";
import { notifyMany } from "./notifications";
import { loadPeopleMap } from "./landlords";
import { resolveAgreedCommissionPence } from "./commission-engine";
import {
  checkPublishReadiness,
  resolveRent,
  validateCommissionValue,
  validateRoomCounts,
  type PublishReadiness,
} from "./listing-rules";
import {
  canArchiveProperty,
  canEditProperty,
  canPublishProperty,
  canViewProperty,
  ForbiddenError,
  propertyVisibilityFilter,
  withVisibility,
  type AccessContext,
} from "./permissions";

/**
 * Property records: onboarding, rooms, public details and website publishing.
 *
 * Two independent lifecycles live on a property and must never be conflated:
 *   listingStatus  where the property is on the public website
 *   dealStage      where it is in the letting pipeline
 */

export type PropertyCategory = (typeof propertyCategoryEnum.enumValues)[number];
export type LivingRoom = (typeof livingRoomEnum.enumValues)[number];
export type CommissionType = (typeof commissionTypeEnum.enumValues)[number];
export type ContactSource = (typeof contactSourceEnum.enumValues)[number];

export class PropertyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyError";
  }
}

/* ----------------------------------------------------------------- input */

export type PropertyFeatures = {
  furnished?: boolean | null;
  livingLandlord?: boolean | null;
  garden?: boolean | null;
  parking?: boolean | null;
  billsIncluded?: boolean | null;
  balcony?: boolean | null;
  disabledAccess?: boolean | null;
  wifi?: boolean | null;
  couplesAllowed?: boolean | null;
  petsAllowed?: boolean | null;
  dssAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
};

export const FEATURE_FIELDS = [
  "furnished",
  "livingLandlord",
  "garden",
  "parking",
  "billsIncluded",
  "balcony",
  "disabledAccess",
  "wifi",
  "couplesAllowed",
  "petsAllowed",
  "dssAllowed",
  "childrenAllowed",
] as const satisfies readonly (keyof PropertyFeatures)[];

export const FEATURE_LABELS: Record<keyof PropertyFeatures, string> = {
  furnished: "Furnished",
  livingLandlord: "Living landlord",
  garden: "Garden",
  parking: "Parking",
  billsIncluded: "Bills included",
  balcony: "Balcony / roof terrace",
  disabledAccess: "Disabled access",
  wifi: "Wi-Fi",
  couplesAllowed: "Couples allowed",
  petsAllowed: "Pets allowed",
  dssAllowed: "DSS allowed",
  childrenAllowed: "Children allowed",
};

export type RoomInput = {
  name: string;
  availabilityDate?: string | null;
  rentFrequency: "MONTHLY" | "WEEKLY";
  /** The amount the user typed, in pence, at the frequency they chose. */
  rentPence: number;
  depositPence?: number | null;
  commissionType?: CommissionType | null;
  commissionValue?: number | null;
};

export type AddressInput = {
  addressLine1: string;
  doorNumber?: string | null;
  addressLine2?: string | null;
  town?: string | null;
  county?: string | null;
  postcode: string;
  area?: string | null;
};

export type CreatePropertyInput = {
  landlordId: string;
  propertyType: "FULL" | "SHARED";
  category?: PropertyCategory | null;
  address: AddressInput;
  features: PropertyFeatures;
  livingRoom?: LivingRoom | null;

  /* full property */
  numberOfRooms?: number | null;
  availableRooms?: number | null;
  bathrooms?: number | null;
  availabilityDate?: string | null;
  rentPerMonthPence?: number | null;
  depositPence?: number | null;
  commissionType?: CommissionType | null;
  commissionValue?: number | null;

  /* shared property */
  rooms?: RoomInput[];

  /* optional public details, when the user chooses to add them now */
  title?: string | null;
  description?: string | null;
  imageAssetIds?: string[];

  source?: ContactSource;
  originatingCallId?: string | null;
  /** Admin-only attribution when creating outside the call workflow. */
  originatingFronterId?: string | null;
  assignedAgentId?: string | null;
};

/* ------------------------------------------------------------ validation */

function validateAddress(address: AddressInput): { formatted: string; postcode: string; outcode: string } {
  if (!address.addressLine1.trim()) throw new PropertyError("Enter the property address.");

  const parsed = parsePostcode(address.postcode);
  if (!parsed) throw new PropertyError("Enter a valid UK postcode, for example M14 5AB.");

  const parts = [
    address.addressLine1.trim(),
    address.addressLine2?.trim(),
    address.town?.trim(),
    address.county?.trim(),
    parsed.formatted,
  ].filter(Boolean);

  return { formatted: parts.join(", "), postcode: parsed.formatted, outcode: parsed.outcode };
}

function validateFullProperty(input: CreatePropertyInput): void {
  if (!input.category) throw new PropertyError("Choose a property category.");

  validateRoomCounts({
    category: input.category,
    numberOfRooms: input.numberOfRooms,
    availableRooms: input.availableRooms,
  });

  if (!input.rentPerMonthPence || input.rentPerMonthPence <= 0) {
    throw new PropertyError("Enter the monthly rent.");
  }
  if (input.depositPence == null || input.depositPence < 0) {
    throw new PropertyError("Enter the deposit.");
  }
  if (!input.commissionType || input.commissionValue == null) {
    throw new PropertyError("Enter the commission agreed with the landlord.");
  }
}

function validateSharedProperty(input: CreatePropertyInput): void {
  if (!input.rooms || input.rooms.length === 0) {
    throw new PropertyError("A shared property needs at least one room.");
  }
  input.rooms.forEach((room, index) => {
    if (!room.name.trim()) throw new PropertyError(`Room ${index + 1} needs a name.`);
    if (!room.rentPence || room.rentPence <= 0) {
      throw new PropertyError(`Enter the rent for ${room.name.trim() || `room ${index + 1}`}.`);
    }
  });
}

/* --------------------------------------------------- duplicate detection */

/** Normalised for comparison: "Flat 6, 18 Cranbrook Rd" -> "flat618cranbrookrd". */
function addressKey(line1: string): string {
  return line1.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type DuplicateCandidate = {
  id: string;
  reference: string;
  formattedAddress: string;
  landlordName: string;
  listingStatus: string;
};

/**
 * Likely duplicates by postcode and address similarity. Never merges anything
 * automatically - the user is warned and decides.
 */
export async function findDuplicateCandidates(
  address: AddressInput,
  landlordId: string | null,
): Promise<DuplicateCandidate[]> {
  const parsed = parsePostcode(address.postcode);
  if (!parsed) return [];

  const rows = await db
    .select({
      id: properties.id,
      reference: properties.reference,
      formattedAddress: properties.formattedAddress,
      addressLine1: properties.addressLine1,
      landlordId: properties.landlordId,
      listingStatus: properties.listingStatus,
      landlordName: landlords.name,
    })
    .from(properties)
    .innerJoin(landlords, eq(landlords.id, properties.landlordId))
    .where(and(eq(properties.postcode, parsed.formatted), isNull(properties.deletedAt)))
    .limit(20);

  const key = addressKey(address.addressLine1);

  return rows
    .filter((row) => {
      const candidate = addressKey(row.addressLine1);
      // Same postcode plus either the same landlord or a matching street line.
      return (
        row.landlordId === landlordId ||
        candidate === key ||
        candidate.includes(key) ||
        key.includes(candidate)
      );
    })
    .map((row) => ({
      id: row.id,
      reference: row.reference,
      formattedAddress: row.formattedAddress,
      landlordName: row.landlordName,
      listingStatus: row.listingStatus,
    }));
}

/* ---------------------------------------------------------------- create */

export async function createProperty(
  input: CreatePropertyInput,
  context: AccessContext,
): Promise<{ id: string; reference: string; listingStatus: string }> {
  const address = validateAddress(input.address);
  validateCommissionValue(input.commissionType, input.commissionValue);

  if (input.propertyType === "FULL") validateFullProperty(input);
  else validateSharedProperty(input);

  return db.transaction(async (tx) => {
    const landlordRows = await tx
      .select({
        id: landlords.id,
        name: landlords.name,
        originatingFronterId: landlords.originatingFronterId,
        assignedAgentId: landlords.assignedAgentId,
      })
      .from(landlords)
      .where(and(eq(landlords.id, input.landlordId), isNull(landlords.deletedAt)))
      .limit(1);

    const landlord = landlordRows[0];
    if (!landlord) throw new PropertyError("That landlord no longer exists.");

    // A property inherits the landlord's ownership, so the fronter who won the
    // landlord is credited for every property on it.
    const originatingFronterId = context.isAdmin
      ? (input.originatingFronterId ?? landlord.originatingFronterId)
      : (landlord.originatingFronterId ?? (context.isFronter ? context.user.id : null));

    const assignedAgentId = context.isAdmin
      ? (input.assignedAgentId ?? landlord.assignedAgentId)
      : (landlord.assignedAgentId ?? (context.isAgent ? context.user.id : context.managingAgentId));

    const reference = await nextPropertyReference(tx);

    const hasPublicDetails = Boolean(input.title?.trim() && input.description?.trim());
    const imageCount = input.imageAssetIds?.length ?? 0;

    const commissionAmountPence =
      input.propertyType === "FULL"
        ? resolveAgreedCommissionPence(
            input.commissionType && input.commissionValue != null
              ? { type: input.commissionType, value: input.commissionValue }
              : null,
            input.rentPerMonthPence ?? null,
          )
        : null;

    const isStudio = input.category === "STUDIO_FLAT";

    const inserted = await tx
      .insert(properties)
      .values({
        reference,
        landlordId: landlord.id,
        propertyType: input.propertyType,
        category: input.propertyType === "SHARED" ? (input.category ?? "HOUSE") : input.category,

        addressLine1: input.address.addressLine1.trim(),
        addressLine2: input.address.addressLine2?.trim() || null,
        doorNumber: input.address.doorNumber?.trim() || null,
        town: input.address.town?.trim() || null,
        county: input.address.county?.trim() || null,
        postcode: address.postcode,
        outcode: address.outcode,
        formattedAddress: address.formatted,
        area: input.address.area?.trim() || input.address.town?.trim() || null,

        ...pickFeatures(input.features),
        livingRoom: isStudio ? null : (input.livingRoom ?? null),

        numberOfRooms: isStudio ? null : (input.numberOfRooms ?? null),
        availableRooms: isStudio ? null : (input.availableRooms ?? null),
        bathrooms: input.bathrooms ?? null,
        availabilityDate: input.propertyType === "FULL" ? (input.availabilityDate ?? null) : null,
        rentPerMonthPence: input.propertyType === "FULL" ? (input.rentPerMonthPence ?? null) : null,
        rentPerWeekPence:
          input.propertyType === "FULL" && input.rentPerMonthPence
            ? monthlyToWeeklyPence(input.rentPerMonthPence)
            : null,
        depositPence: input.propertyType === "FULL" ? (input.depositPence ?? null) : null,
        commissionType: input.propertyType === "FULL" ? (input.commissionType ?? null) : null,
        commissionValue: input.propertyType === "FULL" ? (input.commissionValue ?? null) : null,
        commissionAmountPence,

        title: input.title?.trim() || null,
        description: input.description?.trim() || null,

        listingStatus: hasPublicDetails && imageCount > 0 ? "READY_TO_PUBLISH" : "DRAFT",
        dealStage: "AVAILABLE",

        originatingFronterId,
        assignedAgentId,
        createdBy: context.user.id,
        source: input.source ?? (context.isFronter ? "CALL" : "MANUAL"),
        originatingCallId: input.originatingCallId ?? null,
      })
      .returning({ id: properties.id, listingStatus: properties.listingStatus });

    const property = inserted[0];

    if (input.propertyType === "SHARED" && input.rooms) {
      await insertRooms(tx, property.id, input.rooms);
    }

    if (input.imageAssetIds && input.imageAssetIds.length > 0) {
      await attachImages(tx, property.id, input.imageAssetIds);
    }

    await recordActivity(
      {
        type: "PROPERTY_CREATED",
        entityType: ENTITY.property,
        entityId: property.id,
        relatedEntityType: ENTITY.landlord,
        relatedEntityId: landlord.id,
        actorId: context.user.id,
        summary: `${context.user.fullName} added a ${
          input.propertyType === "SHARED" ? "shared property" : "property"
        } at ${address.formatted}`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "CREATE",
        entityType: ENTITY.property,
        entityId: property.id,
        entityLabel: reference,
        after: { reference, address: address.formatted, propertyType: input.propertyType },
      },
      tx,
    );

    // The agent needs to know a property is waiting for its public details.
    if (property.listingStatus === "DRAFT" && assignedAgentId) {
      await notifyMany(
        [assignedAgentId],
        {
          type: "PROPERTY_NEEDS_PUBLIC_DETAILS",
          title: "Property needs public details",
          body: `${reference} at ${address.formatted} is saved as a draft.`,
          href: `/properties/${property.id}`,
          entityType: ENTITY.property,
          entityId: property.id,
        },
        tx,
      );
    }

    return { id: property.id, reference, listingStatus: property.listingStatus };
  });
}

function pickFeatures(features: PropertyFeatures) {
  const result: Record<string, boolean | null> = {};
  for (const field of FEATURE_FIELDS) {
    result[field] = features[field] ?? null;
  }
  return result;
}

async function insertRooms(tx: Transaction, propertyId: string, rooms: RoomInput[]) {
  await tx.insert(propertyRooms).values(
    rooms.map((room, index) => {
      const rent = resolveRent(room.rentPence, room.rentFrequency);
      validateCommissionValue(room.commissionType, room.commissionValue);

      return {
        propertyId,
        name: room.name.trim(),
        sortOrder: index,
        availabilityDate: room.availabilityDate || null,
        rentFrequency: room.rentFrequency,
        rentPerMonthPence: rent.rentPerMonthPence,
        rentPerWeekPence: rent.rentPerWeekPence,
        depositPence: room.depositPence ?? null,
        commissionType: room.commissionType ?? null,
        commissionValue: room.commissionValue ?? null,
        commissionAmountPence: resolveAgreedCommissionPence(
          room.commissionType && room.commissionValue != null
            ? { type: room.commissionType, value: room.commissionValue }
            : null,
          rent.rentPerMonthPence,
        ),
        status: "AVAILABLE" as const,
      };
    }),
  );
}

async function attachImages(tx: Transaction, propertyId: string, assetIds: string[]) {
  const existing = await tx
    .select({ assetId: propertyImages.assetId })
    .from(propertyImages)
    .where(eq(propertyImages.propertyId, propertyId));

  const already = new Set(existing.map((row) => row.assetId));
  const toAdd = assetIds.filter((id) => !already.has(id));
  if (toAdd.length === 0) return;

  const hasCover = existing.length > 0;

  await tx.insert(propertyImages).values(
    toAdd.map((assetId, index) => ({
      propertyId,
      assetId,
      sortOrder: already.size + index,
      // The first image on a property with no cover yet becomes the cover.
      isCover: !hasCover && index === 0,
    })),
  );
}

async function nextPropertyReference(tx: Transaction): Promise<string> {
  const rows = await executeRows<{ value: string }>(
    tx,
    raw`select nextval('property_reference_seq')::text as value`,
  );
  return formatReference(REFERENCE_PREFIX.property, Number(rows[0]?.value ?? 1));
}

/* ------------------------------------------------------- public details */

export type PublicDetailsInput = {
  title: string;
  description: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  imageAssetIds?: string[];
  coverAssetId?: string | null;
};

/**
 * Complete or update the public listing content. Reaching a complete set of
 * details moves a draft to READY_TO_PUBLISH but never publishes on its own -
 * putting a property on the website is always a deliberate act.
 */
export async function savePublicDetails(
  propertyId: string,
  input: PublicDetailsInput,
  context: AccessContext,
): Promise<{ listingStatus: string }> {
  if (!input.title.trim()) throw new PropertyError("Enter a property title.");
  if (!input.description.trim()) throw new PropertyError("Enter a property description.");

  return db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context);

    if (input.imageAssetIds && input.imageAssetIds.length > 0) {
      await attachImages(tx, propertyId, input.imageAssetIds);
    }

    if (input.coverAssetId) {
      await tx
        .update(propertyImages)
        .set({ isCover: false })
        .where(eq(propertyImages.propertyId, propertyId));
      await tx
        .update(propertyImages)
        .set({ isCover: true })
        .where(
          and(
            eq(propertyImages.propertyId, propertyId),
            eq(propertyImages.assetId, input.coverAssetId),
          ),
        );
    }

    const imageCount = await tx
      .select({ value: count() })
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));

    const hasImages = Number(imageCount[0]?.value ?? 0) > 0;

    // Once live, edits stay live; a draft becomes ready when it is complete.
    const nextStatus =
      property.listingStatus === "PUBLISHED"
        ? "PUBLISHED"
        : hasImages
          ? "READY_TO_PUBLISH"
          : "DRAFT";

    await tx
      .update(properties)
      .set({
        title: input.title.trim(),
        description: input.description.trim(),
        metaTitle: input.metaTitle?.trim() || defaultMetaTitle(property, input.title),
        metaDescription:
          input.metaDescription?.trim() || defaultMetaDescription(input.description),
        listingStatus: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} updated the public listing details`,
      },
      tx,
    );

    return { listingStatus: nextStatus };
  });
}

/*
 * Both are cut at the length a search result shows, at a word boundary. A
 * title that ends mid-word looks like a fault rather than a listing.
 */
function defaultMetaTitle(
  property: { propertyType: string; category: string | null; town: string | null; outcode: string },
  title: string,
): string {
  const place = property.town ? `${property.town} ${property.outcode}` : property.outcode;
  const withPlace = `${title.trim()} | ${place}`;

  // The place is only worth adding if the whole thing still fits.
  return withPlace.length <= MAX_TITLE_LENGTH
    ? withPlace
    : truncateAtWord(title, MAX_TITLE_LENGTH);
}

function defaultMetaDescription(description: string): string {
  return truncateAtWord(description, MAX_DESCRIPTION_LENGTH, true);
}

/* ------------------------------------------------------------- publish */

export { checkPublishReadiness, resolveRent };
export type { PublishReadiness };

export type FullPropertyInput = {
  propertyType?: "FULL" | "SHARED";
  category?: "HOUSE" | "FLAT" | "STUDIO_FLAT" | null;

  addressLine1?: string;
  addressLine2?: string | null;
  doorNumber?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string;
  area?: string | null;

  features?: Record<string, boolean | null>;
  livingRoom?: "SHARED" | "PRIVATE" | "NONE" | null;

  numberOfRooms?: number | null;
  availableRooms?: number | null;
  bathrooms?: number | null;
  availabilityDate?: string | null;

  rentPerMonthPence?: number | null;
  depositPence?: number | null;
  commissionType?: "PERCENTAGE" | "FIXED" | null;
  commissionValue?: number | null;

  title?: string | null;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

/**
 * Admin edit of every field on a property.
 *
 * The ordinary paths are deliberately narrow - publish, save public details,
 * add a room - because each enforces the rule that belongs to it. This is the
 * override for when the record is simply wrong: an address typed incorrectly,
 * a rent agreed at a different figure, a category picked in haste.
 *
 * Admin only, and every change is audited with the before and after values, so
 * a correction can always be traced. The database still refuses anything
 * incoherent - more available rooms than the property has, for one - because
 * those constraints hold whoever is writing.
 */
export async function updateFullProperty(
  id: string,
  input: FullPropertyInput,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(properties).where(eq(properties.id, id)).limit(1);
    const existing = rows[0];
    if (!existing || existing.deletedAt) throw new PropertyError("That property no longer exists.");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    const changed: Record<string, { from: unknown; to: unknown }> = {};

    const note = (field: string, from: unknown, to: unknown) => {
      if (from !== to) changed[field] = { from, to };
    };

    /* ------------------------------------------------------------ address */

    const addressTouched =
      input.addressLine1 !== undefined ||
      input.addressLine2 !== undefined ||
      input.town !== undefined ||
      input.county !== undefined ||
      input.postcode !== undefined;

    if (addressTouched) {
      const address = {
        addressLine1: input.addressLine1 ?? existing.addressLine1,
        addressLine2: input.addressLine2 ?? existing.addressLine2,
        town: input.town ?? existing.town,
        county: input.county ?? existing.county,
        postcode: input.postcode ?? existing.postcode,
      };

      // Revalidated as a whole, so the outcode and the formatted address stay
      // in step with the parts they are derived from.
      const parsed = validateAddress(address);

      patch.addressLine1 = address.addressLine1.trim();
      patch.addressLine2 = address.addressLine2?.trim() || null;
      patch.town = address.town?.trim() || null;
      patch.county = address.county?.trim() || null;
      patch.postcode = parsed.postcode;
      patch.outcode = parsed.outcode;
      patch.formattedAddress = parsed.formatted;

      note("address", existing.formattedAddress, parsed.formatted);
    }

    if (input.doorNumber !== undefined) {
      patch.doorNumber = input.doorNumber?.trim() || null;
      note("doorNumber", existing.doorNumber, patch.doorNumber);
    }
    if (input.area !== undefined) {
      patch.area = input.area?.trim() || null;
      note("area", existing.area, patch.area);
    }

    /* --------------------------------------------------------------- type */

    if (input.propertyType !== undefined) {
      patch.propertyType = input.propertyType;
      note("propertyType", existing.propertyType, input.propertyType);
    }
    if (input.category !== undefined) {
      patch.category = input.category;
      note("category", existing.category, input.category);
    }

    /* ----------------------------------------------------------- features */

    if (input.features) Object.assign(patch, pickFeatures(input.features));
    if (input.livingRoom !== undefined) patch.livingRoom = input.livingRoom;

    /* ------------------------------------------------------------ numbers */

    const numeric: [keyof FullPropertyInput, string][] = [
      ["numberOfRooms", "numberOfRooms"],
      ["availableRooms", "availableRooms"],
      ["bathrooms", "bathrooms"],
      ["depositPence", "depositPence"],
      ["commissionValue", "commissionValue"],
    ];

    for (const [key, column] of numeric) {
      if (input[key] !== undefined) {
        patch[column] = input[key];
        note(column, (existing as Record<string, unknown>)[column], input[key]);
      }
    }

    if (input.availabilityDate !== undefined) {
      patch.availabilityDate = input.availabilityDate || null;
      note("availabilityDate", existing.availabilityDate, patch.availabilityDate);
    }
    if (input.commissionType !== undefined) {
      patch.commissionType = input.commissionType;
      note("commissionType", existing.commissionType, input.commissionType);
    }

    // The weekly figure is derived, so it must move with the monthly one.
    if (input.rentPerMonthPence !== undefined) {
      patch.rentPerMonthPence = input.rentPerMonthPence;
      patch.rentPerWeekPence = input.rentPerMonthPence
        ? monthlyToWeeklyPence(input.rentPerMonthPence)
        : null;
      note("rentPerMonthPence", existing.rentPerMonthPence, input.rentPerMonthPence);
    }

    /*
     * The estimated gross is derived from the commission and the rent, so it
     * is recalculated whenever either of them moves. Left alone it went stale:
     * the record showed the old estimate, and a deal opened from it inherited
     * a figure nobody had agreed.
     */
    if (
      input.commissionType !== undefined ||
      input.commissionValue !== undefined ||
      input.rentPerMonthPence !== undefined ||
      input.propertyType !== undefined
    ) {
      const type =
        input.commissionType !== undefined ? input.commissionType : existing.commissionType;
      const value =
        input.commissionValue !== undefined ? input.commissionValue : existing.commissionValue;
      const monthlyRent =
        input.rentPerMonthPence !== undefined
          ? input.rentPerMonthPence
          : existing.rentPerMonthPence;

      validateCommissionValue(type, value);

      // A shared property earns per room, so the property-level estimate stays
      // empty rather than reading as zero.
      const propertyType =
        input.propertyType !== undefined ? input.propertyType : existing.propertyType;

      patch.commissionAmountPence =
        propertyType === "FULL"
          ? resolveAgreedCommissionPence(
              type && value != null ? { type, value } : null,
              monthlyRent ?? null,
            )
          : null;

      note("commissionAmountPence", existing.commissionAmountPence, patch.commissionAmountPence);
    }

    /* ------------------------------------------------------------ listing */

    for (const key of ["title", "description", "metaTitle", "metaDescription"] as const) {
      if (input[key] !== undefined) {
        patch[key] = input[key]?.trim() || null;
        note(key, (existing as Record<string, unknown>)[key], patch[key]);
      }
    }

    await tx.update(properties).set(patch).where(eq(properties.id, id));

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} edited the property record`,
        metadata: { fields: Object.keys(changed) },
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.property,
        entityId: id,
        entityLabel: existing.reference,
        metadata: { changed },
      },
      tx,
    );
  });
}

export async function publishProperty(
  propertyId: string,
  context: AccessContext,
): Promise<{ slug: string }> {
  return db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context, canPublishProperty);

    const [imageCountRow, roomCountRow] = await Promise.all([
      tx
        .select({ value: count() })
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, propertyId)),
      tx
        .select({ value: count() })
        .from(propertyRooms)
        .where(and(eq(propertyRooms.propertyId, propertyId), isNull(propertyRooms.deletedAt))),
    ]);

    const readiness = checkPublishReadiness({
      title: property.title,
      description: property.description,
      imageCount: Number(imageCountRow[0]?.value ?? 0),
      propertyType: property.propertyType,
      roomCount: Number(roomCountRow[0]?.value ?? 0),
      rentPerMonthPence: property.rentPerMonthPence,
    });

    if (!readiness.ready) {
      throw new PropertyError(
        `This listing is not ready to publish. Still needed: ${readiness.missing.join(", ")}.`,
      );
    }

    // The slug is assigned once and then kept, so a retitle never breaks a
    // live URL that has already been shared or indexed.
    let slug = property.slug;
    if (!slug) {
      const base = buildPropertySlug({
        title: property.title,
        category: property.category,
        bedrooms: property.numberOfRooms,
        town: property.town,
        area: property.area,
        postcode: property.postcode,
        reference: property.reference,
      });

      const taken = await tx
        .select({ slug: properties.slug })
        .from(properties)
        .where(and(ilike(properties.slug, `${base}%`), isNull(properties.deletedAt)));

      slug = disambiguateSlug(
        base,
        new Set(taken.map((row) => row.slug).filter((value): value is string => Boolean(value))),
      );
    }

    await tx
      .update(properties)
      .set({
        slug,
        listingStatus: "PUBLISHED",
        publishedAt: new Date(),
        publishedById: context.user.id,
        unpublishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    await tx.insert(propertyPublications).values({
      propertyId,
      action: "PUBLISH",
      slug,
      snapshot: {
        title: property.title,
        description: property.description,
        postcode: property.postcode,
        propertyType: property.propertyType,
      } as never,
      performedById: context.user.id,
    });

    await recordActivity(
      {
        type: "PROPERTY_PUBLISHED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} published the listing to the website`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "PUBLISH",
        entityType: ENTITY.property,
        entityId: propertyId,
        entityLabel: property.reference,
        after: { slug },
      },
      tx,
    );

    await notifyMany(
      [property.originatingFronterId, property.assignedAgentId],
      {
        type: "PROPERTY_PUBLISHED",
        title: "Property published",
        body: `${property.reference} is now live on the website.`,
        href: `/properties/${propertyId}`,
        entityType: ENTITY.property,
        entityId: propertyId,
      },
      tx,
    );

    return { slug };
  });
}

/**
 * Put a listing on the website's home page, or take it off.
 *
 * Only a published listing can be featured: featuring a draft would promise
 * the home page something the public site cannot show. Uses the publish
 * permission, because this is the same decision - what the outside world sees.
 */
export async function setPropertyFeatured(
  propertyId: string,
  featured: boolean,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context, canPublishProperty);

    if (featured && property.listingStatus !== "PUBLISHED") {
      throw new PropertyError("Publish this listing before featuring it on the home page.");
    }

    await tx
      .update(properties)
      .set({
        isFeatured: featured,
        featuredAt: featured ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: featured
          ? `${context.user.fullName} featured the listing on the home page`
          : `${context.user.fullName} removed the listing from the home page`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.property,
        entityId: propertyId,
        entityLabel: property.reference,
        metadata: { featured },
      },
      tx,
    );
  });
}

/**
 * Mark a live listing as no longer available, or put it back.
 *
 * Deliberately not an unpublish. The page stays on the website with its URL,
 * its ranking and its inbound links intact, and simply says the property is
 * gone - which is both better for search and more use to a visitor following
 * a link they saved last week.
 */
export async function setPropertyAvailability(
  propertyId: string,
  available: boolean,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context, canPublishProperty);

    const publishedStatuses = ["PUBLISHED", "LET_AGREED"];
    if (!publishedStatuses.includes(property.listingStatus)) {
      throw new PropertyError("Only a published listing can be marked unavailable.");
    }

    await tx
      .update(properties)
      .set({
        listingStatus: available ? "PUBLISHED" : "LET_AGREED",
        // A property that is gone should not also be leading the home page.
        ...(available ? {} : { isFeatured: false, featuredAt: null }),
        updatedAt: new Date(),
      })
      .where(eq(properties.id, propertyId));

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: available
          ? `${context.user.fullName} marked the listing available again`
          : `${context.user.fullName} marked the listing unavailable`,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "UPDATE",
        entityType: ENTITY.property,
        entityId: propertyId,
        entityLabel: property.reference,
        metadata: { available },
      },
      tx,
    );
  });
}

export async function unpublishProperty(
  propertyId: string,
  reason: string | null,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context, canPublishProperty);

    await tx
      .update(properties)
      .set({ listingStatus: "UNPUBLISHED", unpublishedAt: new Date(), updatedAt: new Date() })
      .where(eq(properties.id, propertyId));

    await tx.insert(propertyPublications).values({
      propertyId,
      action: "UNPUBLISH",
      slug: property.slug,
      snapshot: { reason } as never,
      performedById: context.user.id,
    });

    await recordActivity(
      {
        type: "PROPERTY_UNPUBLISHED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} removed the listing from the website`,
        metadata: reason ? { reason } : undefined,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "UNPUBLISH",
        entityType: ENTITY.property,
        entityId: propertyId,
        entityLabel: property.reference,
        metadata: { reason },
      },
      tx,
    );
  });
}

/* -------------------------------------------------------------- rooms */

export async function addRoom(
  propertyId: string,
  room: RoomInput,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, propertyId, context);
    if (property.propertyType !== "SHARED") {
      throw new PropertyError("Only a shared property can have rooms.");
    }

    const [existing] = await tx
      .select({ value: count() })
      .from(propertyRooms)
      .where(eq(propertyRooms.propertyId, propertyId));

    const rent = resolveRent(room.rentPence, room.rentFrequency);

    await tx.insert(propertyRooms).values({
      propertyId,
      name: room.name.trim(),
      sortOrder: Number(existing?.value ?? 0),
      availabilityDate: room.availabilityDate || null,
      rentFrequency: room.rentFrequency,
      rentPerMonthPence: rent.rentPerMonthPence,
      rentPerWeekPence: rent.rentPerWeekPence,
      depositPence: room.depositPence ?? null,
      commissionType: room.commissionType ?? null,
      commissionValue: room.commissionValue ?? null,
      commissionAmountPence: resolveAgreedCommissionPence(
        room.commissionType && room.commissionValue != null
          ? { type: room.commissionType, value: room.commissionValue }
          : null,
        rent.rentPerMonthPence,
      ),
      status: "AVAILABLE",
    });

    await recordActivity(
      {
        type: "ROOM_ADDED",
        entityType: ENTITY.property,
        entityId: propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} added ${room.name.trim()}`,
      },
      tx,
    );
  });
}

export async function updateRoom(
  roomId: string,
  room: Partial<RoomInput> & { status?: "AVAILABLE" | "UNAVAILABLE" },
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(propertyRooms).where(eq(propertyRooms.id, roomId)).limit(1);
    const existing = rows[0];
    if (!existing || existing.deletedAt) throw new PropertyError("That room no longer exists.");

    await loadEditableProperty(tx, existing.propertyId, context);

    if (existing.status === "LET") {
      throw new PropertyError("A let room cannot be edited. Record a correction instead.");
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (room.name !== undefined) patch.name = room.name.trim();
    if (room.availabilityDate !== undefined) patch.availabilityDate = room.availabilityDate || null;
    if (room.depositPence !== undefined) patch.depositPence = room.depositPence;
    if (room.commissionType !== undefined) patch.commissionType = room.commissionType;
    if (room.commissionValue !== undefined) patch.commissionValue = room.commissionValue;
    if (room.status !== undefined) patch.status = room.status;

    if (room.rentPence !== undefined && room.rentFrequency !== undefined) {
      const rent = resolveRent(room.rentPence, room.rentFrequency);
      patch.rentFrequency = room.rentFrequency;
      patch.rentPerMonthPence = rent.rentPerMonthPence;
      patch.rentPerWeekPence = rent.rentPerWeekPence;

      if (rent.rentPerMonthPence !== existing.rentPerMonthPence) {
        await tx.insert(propertyHistory).values({
          propertyId: existing.propertyId,
          roomId,
          field: "rentPerMonthPence",
          previousValue: String(existing.rentPerMonthPence),
          newValue: String(rent.rentPerMonthPence),
          changedById: context.user.id,
        });
      }
    }

    // Same derivation as the property: a room's estimated commission follows
    // its own commission terms and its own rent.
    if (
      room.commissionType !== undefined ||
      room.commissionValue !== undefined ||
      patch.rentPerMonthPence !== undefined
    ) {
      const type =
        room.commissionType !== undefined ? room.commissionType : existing.commissionType;
      const value =
        room.commissionValue !== undefined ? room.commissionValue : existing.commissionValue;
      const monthlyRent =
        patch.rentPerMonthPence !== undefined
          ? (patch.rentPerMonthPence as number)
          : existing.rentPerMonthPence;

      validateCommissionValue(type, value);

      patch.commissionAmountPence = resolveAgreedCommissionPence(
        type && value != null ? { type, value } : null,
        monthlyRent ?? null,
      );
    }

    await tx.update(propertyRooms).set(patch).where(eq(propertyRooms.id, roomId));

    await recordActivity(
      {
        type: "ROOM_UPDATED",
        entityType: ENTITY.property,
        entityId: existing.propertyId,
        actorId: context.user.id,
        summary: `${context.user.fullName} updated ${existing.name}`,
      },
      tx,
    );
  });
}

export async function removeRoom(roomId: string, context: AccessContext): Promise<void> {
  await db.transaction(async (tx) => {
    const rows = await tx.select().from(propertyRooms).where(eq(propertyRooms.id, roomId)).limit(1);
    const existing = rows[0];
    if (!existing) throw new PropertyError("That room no longer exists.");

    await loadEditableProperty(tx, existing.propertyId, context);

    if (existing.status === "LET") {
      throw new PropertyError("A let room cannot be removed - its sale history depends on it.");
    }

    const remaining = await tx
      .select({ value: count() })
      .from(propertyRooms)
      .where(and(eq(propertyRooms.propertyId, existing.propertyId), isNull(propertyRooms.deletedAt)));

    if (Number(remaining[0]?.value ?? 0) <= 1) {
      throw new PropertyError("A shared property must keep at least one room.");
    }

    // Soft delete, so any deal that referenced it still resolves.
    await tx
      .update(propertyRooms)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(propertyRooms.id, roomId));
  });
}

/* --------------------------------------------------------------- read */

export type PropertyListFilters = {
  search?: string;
  agentId?: string;
  fronterId?: string;
  propertyType?: "FULL" | "SHARED";
  listingStatus?: string;
  dealStage?: string;
  outcode?: string;
  page?: number;
  pageSize?: number;
};

export async function listProperties(context: AccessContext, filters: PropertyListFilters = {}) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [isNull(properties.deletedAt)];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      or(
        ilike(properties.reference, term),
        ilike(properties.title, term),
        ilike(properties.formattedAddress, term),
        ilike(properties.postcode, term),
        ilike(landlords.name, term),
      ),
    );
  }

  if (filters.agentId) conditions.push(eq(properties.assignedAgentId, filters.agentId));
  if (filters.fronterId) conditions.push(eq(properties.originatingFronterId, filters.fronterId));
  if (filters.propertyType) conditions.push(eq(properties.propertyType, filters.propertyType));
  if (filters.outcode) conditions.push(eq(properties.outcode, filters.outcode.toUpperCase()));
  if (filters.listingStatus) {
    conditions.push(
      eq(properties.listingStatus, filters.listingStatus as typeof properties.$inferSelect.listingStatus),
    );
  }
  if (filters.dealStage) {
    conditions.push(eq(properties.dealStage, filters.dealStage as typeof properties.$inferSelect.dealStage));
  }

  const where = withVisibility(and(...conditions), propertyVisibilityFilter(context));

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: properties.id,
        reference: properties.reference,
        title: properties.title,
        formattedAddress: properties.formattedAddress,
        postcode: properties.postcode,
        outcode: properties.outcode,
        area: properties.area,
        propertyType: properties.propertyType,
        category: properties.category,
        listingStatus: properties.listingStatus,
        isFeatured: properties.isFeatured,
        dealStage: properties.dealStage,
        rentPerMonthPence: properties.rentPerMonthPence,
        numberOfRooms: properties.numberOfRooms,
        availableRooms: properties.availableRooms,
        createdAt: properties.createdAt,
        landlordId: properties.landlordId,
        landlordName: landlords.name,
        originatingFronterId: properties.originatingFronterId,
        assignedAgentId: properties.assignedAgentId,
        roomsTotal: raw<number>`(
          select count(*)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null
        )`,
        roomsAvailable: raw<number>`(
          select count(*)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null and r.status = 'AVAILABLE'
        )`,
        fromRentPence: raw<number | null>`(
          select min(r.rent_per_month_pence)::int from ${propertyRooms} r
          where r.property_id = ${properties.id} and r.deleted_at is null and r.status = 'AVAILABLE'
        )`,
        coverUrl: raw<string | null>`(
          select a.url from ${propertyImages} pi
          join ${imageAssets} a on a.id = pi.asset_id
          where pi.property_id = ${properties.id} and a.deleted_at is null
          order by pi.is_cover desc, pi.sort_order asc
          limit 1
        )`,
      })
      .from(properties)
      .innerJoin(landlords, eq(landlords.id, properties.landlordId))
      .where(where)
      .orderBy(desc(properties.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(properties)
      .innerJoin(landlords, eq(landlords.id, properties.landlordId))
      .where(where),
  ]);

  const total = Number(totalRows[0]?.value ?? 0);
  const people = await loadPeopleMap(
    rows.flatMap((row) => [row.originatingFronterId, row.assignedAgentId]),
  );

  return {
    rows: rows.map((row) => ({
      ...row,
      roomsTotal: Number(row.roomsTotal),
      roomsAvailable: Number(row.roomsAvailable),
      fromRentPence: row.fromRentPence === null ? null : Number(row.fromRentPence),
      fronter: row.originatingFronterId ? (people.get(row.originatingFronterId) ?? null) : null,
      agent: row.assignedAgentId ? (people.get(row.assignedAgentId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProperty(id: string, context: AccessContext) {
  const rows = await db
    .select({ property: properties, landlord: landlords })
    .from(properties)
    .innerJoin(landlords, eq(landlords.id, properties.landlordId))
    .where(eq(properties.id, id))
    .limit(1);

  const row = rows[0];
  if (!row || row.property.deletedAt) return null;
  if (!canViewProperty(context, row.property)) throw new ForbiddenError();

  const [rooms, images, people, publications, history] = await Promise.all([
    db
      .select()
      .from(propertyRooms)
      .where(and(eq(propertyRooms.propertyId, id), isNull(propertyRooms.deletedAt)))
      .orderBy(asc(propertyRooms.sortOrder)),

    db
      .select({
        id: propertyImages.id,
        assetId: imageAssets.id,
        url: imageAssets.url,
        altText: imageAssets.altText,
        fileName: imageAssets.fileName,
        isCover: propertyImages.isCover,
        sortOrder: propertyImages.sortOrder,
      })
      .from(propertyImages)
      .innerJoin(imageAssets, eq(imageAssets.id, propertyImages.assetId))
      .where(and(eq(propertyImages.propertyId, id), isNull(imageAssets.deletedAt)))
      .orderBy(desc(propertyImages.isCover), asc(propertyImages.sortOrder)),

    loadPeopleMap([
      row.property.originatingFronterId,
      row.property.assignedAgentId,
      row.property.createdBy,
      row.property.publishedById,
    ]),

    db
      .select({
        id: propertyPublications.id,
        action: propertyPublications.action,
        slug: propertyPublications.slug,
        performedAt: propertyPublications.performedAt,
        performedById: propertyPublications.performedById,
      })
      .from(propertyPublications)
      .where(eq(propertyPublications.propertyId, id))
      .orderBy(desc(propertyPublications.performedAt))
      .limit(10),

    db
      .select()
      .from(propertyHistory)
      .where(eq(propertyHistory.propertyId, id))
      .orderBy(desc(propertyHistory.changedAt))
      .limit(25),
  ]);

  const readiness = checkPublishReadiness({
    title: row.property.title,
    description: row.property.description,
    imageCount: images.length,
    propertyType: row.property.propertyType,
    roomCount: rooms.length,
    rentPerMonthPence: row.property.rentPerMonthPence,
  });

  return {
    property: row.property,
    landlord: row.landlord,
    rooms,
    images,
    publications,
    history,
    readiness,
    fronter: row.property.originatingFronterId
      ? (people.get(row.property.originatingFronterId) ?? null)
      : null,
    agent: row.property.assignedAgentId
      ? (people.get(row.property.assignedAgentId) ?? null)
      : null,
    creator: people.get(row.property.createdBy) ?? null,
    canEdit: canEditProperty(context, row.property),
    canPublish: canPublishProperty(context, row.property),
    canArchive: canArchiveProperty(context, row.property),
  };
}

/* -------------------------------------------------------------- archive */

/**
 * Move a property to a different agent, or a different originating fronter.
 *
 * Admin only and a reason is required. Commission already calculated against a
 * closed deal is not touched: those figures were snapshotted when the deal
 * closed and belong to whoever earned them. This changes who works the
 * property from here.
 */
export async function reassignProperty(
  id: string,
  next: { agentId?: string | null; fronterId?: string | null },
  reason: string,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();
  if (!reason.trim()) throw new PropertyError("Give a reason for the reassignment.");

  await db.transaction(async (tx) => {
    const rows = await tx.select().from(properties).where(eq(properties.id, id)).limit(1);
    const property = rows[0];
    if (!property || property.deletedAt) throw new PropertyError("That property no longer exists.");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (next.agentId !== undefined) patch.assignedAgentId = next.agentId;
    if (next.fronterId !== undefined) patch.originatingFronterId = next.fronterId;

    await tx.update(properties).set(patch).where(eq(properties.id, id));

    await recordActivity(
      {
        type: "PROPERTY_UPDATED",
        entityType: ENTITY.property,
        entityId: id,
        actorId: context.user.id,
        summary: `${context.user.fullName} reassigned the property`,
        metadata: { reason },
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "REASSIGN",
        entityType: ENTITY.property,
        entityId: id,
        entityLabel: property.reference,
        before: {
          assignedAgentId: property.assignedAgentId,
          originatingFronterId: property.originatingFronterId,
        },
        after: {
          assignedAgentId: next.agentId ?? property.assignedAgentId,
          originatingFronterId: next.fronterId ?? property.originatingFronterId,
        },
        metadata: { reason },
      },
      tx,
    );
  });
}

export async function archiveProperty(
  id: string,
  reason: string | null,
  context: AccessContext,
): Promise<void> {
  await db.transaction(async (tx) => {
    const property = await loadEditableProperty(tx, id, context, canArchiveProperty);

    if (property.dealStage === "VIEWING" || property.dealStage === "VERIFICATION" || property.dealStage === "CLOSING") {
      throw new PropertyError(
        "This property has a live deal. Close or cancel the deal before archiving it.",
      );
    }

    await tx
      .update(properties)
      .set({
        deletedAt: new Date(),
        deletedBy: context.user.id,
        listingStatus: "ARCHIVED",
        updatedAt: new Date(),
      })
      .where(eq(properties.id, id));

    await recordAudit(
      {
        user: context.user,
        action: "ARCHIVE",
        entityType: ENTITY.property,
        entityId: id,
        entityLabel: property.reference,
        metadata: { reason },
      },
      tx,
    );
  });
}

/* --------------------------------------------------------------- shared */

type PermissionCheck = (context: AccessContext, property: {
  createdBy?: string | null;
  originatingFronterId?: string | null;
  assignedAgentId?: string | null;
}) => boolean;

/** Load a property and assert the caller may act on it, inside a transaction. */
async function loadEditableProperty(
  tx: Transaction,
  id: string,
  context: AccessContext,
  check: PermissionCheck = canEditProperty,
) {
  const rows = await tx.select().from(properties).where(eq(properties.id, id)).limit(1);
  const property = rows[0];
  if (!property || property.deletedAt) throw new PropertyError("That property no longer exists.");
  if (!check(context, property)) throw new ForbiddenError();
  return property;
}

/** Agents and admins available to own a property, for admin attribution. */
export async function listAssignableAgents() {
  return db
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(and(inArray(users.role, ["AGENT", "SUPER_ADMIN"]), isNull(users.deletedAt), eq(users.status, "ACTIVE")))
    .orderBy(asc(users.fullName));
}

export async function listAssignableFronters(agentId?: string | null) {
  const conditions: (SQL | undefined)[] = [
    eq(users.role, "FRONTER"),
    isNull(users.deletedAt),
    eq(users.status, "ACTIVE"),
  ];
  if (agentId) conditions.push(eq(users.assignedAgentId, agentId));

  return db
    .select({ id: users.id, fullName: users.fullName, assignedAgentId: users.assignedAgentId })
    .from(users)
    .where(and(...conditions))
    .orderBy(asc(users.fullName));
}

export { formatPostcode, getOutcode };
