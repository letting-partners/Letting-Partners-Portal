"use server";

import { revalidatePath } from "next/cache";
import { MAX_TITLE_LENGTH } from "@/services/listing-seo";
import { z } from "zod";
import { genderEnum } from "@/db/schema";
import { ForbiddenError, requireAccess } from "@/services/permissions";
import {
  createLandlord,
  findLandlordSummary,
  LandlordError,
  listLandlords,
  type LandlordSummary,
} from "@/services/landlords";
import {
  createProperty,
  findDuplicateCandidates,
  PropertyError,
  type DuplicateCandidate,
} from "@/services/properties";

/**
 * Actions behind the landlord and property onboarding wizard.
 *
 * The landlord is created as soon as their details are complete, so a fronter
 * who wins a landlord on a call keeps the credit even if they abandon the
 * property steps. The property is created at the end.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof LandlordError || error instanceof PropertyError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Property onboarding action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

/* -------------------------------------------------------------- landlord */

const landlordSchema = z.object({
  name: z.string().trim().min(1, "Enter the landlord name.").max(160),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().min(1, "Enter a phone number."),
  gender: z.enum(genderEnum.enumValues),
  dealerType: z.enum(["LANDLORD", "AGENT"]).optional(),
});

/**
 * Whether the number onboarding is about to use already belongs to a landlord.
 *
 * The page equivalent of this happens server-side before the wizard renders;
 * in the popup there is no render to hang it on, so it is asked for directly.
 */
export async function findLandlordForOnboardingAction(input: {
  landlordId?: string | null;
  phone?: string | null;
}): Promise<ActionResult<LandlordSummary | null>> {
  try {
    await requireAccess();
    return { ok: true, data: await findLandlordSummary(input) };
  } catch (error) {
    return fail(error);
  }
}

export async function createLandlordAction(input: {
  name: string;
  email?: string | null;
  phone: string;
  gender: string;
  dealerType?: "LANDLORD" | "AGENT";
}): Promise<ActionResult<{ landlordId: string }>> {
  try {
    const parsed = landlordSchema.parse(input);

    if (parsed.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parsed.email)) {
      return { ok: false, error: "Enter a valid email address, or leave it blank." };
    }

    const context = await requireAccess();
    const landlord = await createLandlord(
      {
        name: parsed.name,
        email: parsed.email || null,
        phone: parsed.phone,
        gender: parsed.gender,
        dealerType: parsed.dealerType,
      },
      context,
    );

    revalidatePath("/landlords");
    return { ok: true, data: { landlordId: landlord.id } };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------- existing landlords */

export type LandlordMatch = {
  id: string;
  name: string;
  phone: string;
  propertyCount: number;
};

/**
 * Landlords the caller is allowed to see, for the "existing landlord" choice.
 *
 * Visibility is the list service's own, so a fronter searching here finds only
 * their own landlords - the picker cannot become a way to read the whole book.
 */
export async function searchLandlordsAction(
  query: string,
): Promise<ActionResult<LandlordMatch[]>> {
  try {
    const context = await requireAccess();
    const term = query.trim();
    if (term.length < 2) return { ok: true, data: [] };

    const result = await listLandlords(context, {
      search: term,
      pageSize: 8,
      sort: "name",
    });

    return {
      ok: true,
      data: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.originalPhone,
        propertyCount: row.propertyCount,
      })),
    };
  } catch (error) {
    return fail(error);
  }
}

/* ------------------------------------------------------------ duplicates */

export async function checkDuplicatesAction(input: {
  addressLine1: string;
  postcode: string;
  landlordId?: string | null;
}): Promise<ActionResult<DuplicateCandidate[]>> {
  try {
    await requireAccess();
    const candidates = await findDuplicateCandidates(
      { addressLine1: input.addressLine1, postcode: input.postcode },
      input.landlordId ?? null,
    );
    return { ok: true, data: candidates };
  } catch (error) {
    return fail(error);
  }
}

/* -------------------------------------------------------------- property */

const roomSchema = z.object({
  name: z.string().trim().min(1, "Every room needs a name."),
  availabilityDate: z.string().optional().nullable(),
  rentFrequency: z.enum(["MONTHLY", "WEEKLY"]),
  rentPence: z.number().int().positive("Enter a rent greater than zero."),
  depositPence: z.number().int().nonnegative().optional().nullable(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionValue: z.number().int().nonnegative().optional().nullable(),
});

const propertySchema = z.object({
  landlordId: z.string().uuid("Add the landlord first."),
  propertyType: z.enum(["FULL", "SHARED"]),
  category: z.enum(["HOUSE", "FLAT", "STUDIO_FLAT"]).optional().nullable(),

  addressLine1: z.string().trim().min(1, "Enter the property address."),
  addressLine2: z.string().trim().optional().nullable(),
  doorNumber: z.string().trim().max(32).optional().nullable(),
  town: z.string().trim().optional().nullable(),
  county: z.string().trim().optional().nullable(),
  postcode: z.string().trim().min(1, "Enter the postcode."),
  area: z.string().trim().optional().nullable(),

  features: z.record(z.string(), z.boolean().nullable()).default({}),
  livingRoom: z.enum(["SHARED", "PRIVATE", "NONE"]).optional().nullable(),

  numberOfRooms: z.number().int().positive().optional().nullable(),
  availableRooms: z.number().int().nonnegative().optional().nullable(),
  bathrooms: z.number().int().nonnegative().optional().nullable(),
  availabilityDate: z.string().optional().nullable(),
  rentPerMonthPence: z.number().int().positive().optional().nullable(),
  depositPence: z.number().int().nonnegative().optional().nullable(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionValue: z.number().int().nonnegative().optional().nullable(),

  rooms: z.array(roomSchema).optional(),

  title: z
    .string()
    .trim()
    .max(MAX_TITLE_LENGTH, `Keep the title to ${MAX_TITLE_LENGTH} characters so it fits a search result.`)
    .optional()
    .nullable(),
  description: z.string().trim().max(8000).optional().nullable(),
  imageAssetIds: z.array(z.string().uuid()).optional(),

  originatingCallId: z.string().uuid().optional().nullable(),
});

export type CreatePropertyActionInput = z.input<typeof propertySchema>;

export async function createPropertyAction(
  input: CreatePropertyActionInput,
): Promise<ActionResult<{ propertyId: string; reference: string; listingStatus: string }>> {
  try {
    const parsed = propertySchema.parse(input);
    const context = await requireAccess();

    const result = await createProperty(
      {
        landlordId: parsed.landlordId,
        propertyType: parsed.propertyType,
        category: parsed.category ?? null,
        address: {
          addressLine1: parsed.addressLine1,
          addressLine2: parsed.addressLine2 ?? null,
          doorNumber: parsed.doorNumber ?? null,
          town: parsed.town ?? null,
          county: parsed.county ?? null,
          postcode: parsed.postcode,
          area: parsed.area ?? null,
        },
        features: parsed.features,
        livingRoom: parsed.livingRoom ?? null,
        numberOfRooms: parsed.numberOfRooms ?? null,
        availableRooms: parsed.availableRooms ?? null,
        bathrooms: parsed.bathrooms ?? null,
        availabilityDate: parsed.availabilityDate ?? null,
        rentPerMonthPence: parsed.rentPerMonthPence ?? null,
        depositPence: parsed.depositPence ?? null,
        commissionType: parsed.commissionType ?? null,
        commissionValue: parsed.commissionValue ?? null,
        rooms: parsed.rooms,
        title: parsed.title ?? null,
        description: parsed.description ?? null,
        imageAssetIds: parsed.imageAssetIds,
        originatingCallId: parsed.originatingCallId ?? null,
      },
      context,
    );

    revalidatePath("/properties");
    revalidatePath("/dashboard");

    return {
      ok: true,
      data: {
        propertyId: result.id,
        reference: result.reference,
        listingStatus: result.listingStatus,
      },
    };
  } catch (error) {
    return fail(error);
  }
}
