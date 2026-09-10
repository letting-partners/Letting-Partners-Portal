"use server";

import { revalidatePath } from "next/cache";
import { MAX_TITLE_LENGTH } from "@/services/listing-seo";
import { z } from "zod";
import { ForbiddenError, requireAccess, requireAdmin } from "@/services/permissions";
import {
  addRoom,
  archiveProperty,
  publishProperty,
  PropertyError,
  removeRoom,
  savePublicDetails,
  setPropertyAvailability,
  updateFullProperty,
  setPropertyFeatured,
  unpublishProperty,
  updateRoom,
} from "@/services/properties";

/** Property actions available from the list rows and the detail page. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof PropertyError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Property action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateProperty(propertyId: string) {
  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
}

export async function publishAction(propertyId: string): Promise<ActionResult<{ slug: string }>> {
  try {
    const context = await requireAccess();
    const result = await publishProperty(propertyId, context);
    revalidateProperty(propertyId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function unpublishAction(
  propertyId: string,
  reason?: string | null,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await unpublishProperty(propertyId, reason ?? null, context);
    revalidateProperty(propertyId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

const fullPropertySchema = z.object({
  propertyId: z.string().uuid(),

  propertyType: z.enum(["FULL", "SHARED"]).optional(),
  category: z.enum(["HOUSE", "FLAT", "STUDIO_FLAT"]).nullable().optional(),

  addressLine1: z.string().trim().min(1, "Enter the address.").max(200).optional(),
  addressLine2: z.string().trim().max(200).nullable().optional(),
  doorNumber: z.string().trim().max(32).nullable().optional(),
  town: z.string().trim().max(120).nullable().optional(),
  county: z.string().trim().max(120).nullable().optional(),
  postcode: z.string().trim().max(10).optional(),
  area: z.string().trim().max(120).nullable().optional(),

  features: z.record(z.string(), z.boolean().nullable()).optional(),
  livingRoom: z.enum(["SHARED", "PRIVATE", "NONE"]).nullable().optional(),

  numberOfRooms: z.number().int().nonnegative().nullable().optional(),
  availableRooms: z.number().int().nonnegative().nullable().optional(),
  bathrooms: z.number().int().nonnegative().nullable().optional(),
  availabilityDate: z.string().trim().max(40).nullable().optional(),

  rentPerMonthPence: z.number().int().nonnegative().nullable().optional(),
  depositPence: z.number().int().nonnegative().nullable().optional(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
  commissionValue: z.number().int().nonnegative().nullable().optional(),

  title: z
    .string()
    .trim()
    .max(MAX_TITLE_LENGTH, `Keep the title to ${MAX_TITLE_LENGTH} characters.`)
    .nullable()
    .optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  metaTitle: z.string().trim().max(240).nullable().optional(),
  metaDescription: z.string().trim().max(400).nullable().optional(),
});

/** Admin edit of every field on a property. */
export async function updateFullPropertyAction(
  input: z.input<typeof fullPropertySchema>,
): Promise<ActionResult> {
  try {
    const { propertyId, ...rest } = fullPropertySchema.parse(input);
    const context = await requireAdmin();

    await updateFullProperty(propertyId, rest, context);

    revalidatePath("/properties");
    revalidatePath(`/properties/${propertyId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/**
 * Mark a listing unavailable on the website, or available again. The page
 * stays live either way - see setPropertyAvailability.
 */
export async function setAvailabilityAction(
  propertyId: string,
  available: boolean,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await setPropertyAvailability(propertyId, available, context);
    revalidatePath("/properties");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/** Put a published listing on the website home page, or take it off. */
export async function setFeaturedAction(
  propertyId: string,
  featured: boolean,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await setPropertyFeatured(propertyId, featured, context);
    revalidatePath("/properties");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveAction(
  propertyId: string,
  reason?: string | null,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await archiveProperty(propertyId, reason ?? null, context);
    revalidatePath("/properties");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

const publicDetailsSchema = z.object({
  propertyId: z.string().uuid(),
  title: z
    .string()
    .trim()
    .min(1, "Enter a property title.")
    .max(MAX_TITLE_LENGTH, `Keep the title to ${MAX_TITLE_LENGTH} characters so it fits a search result.`),
  description: z.string().trim().min(1, "Enter a description.").max(8000),
  metaTitle: z.string().trim().max(200).optional().nullable(),
  metaDescription: z.string().trim().max(320).optional().nullable(),
  imageAssetIds: z.array(z.string().uuid()).optional(),
  coverAssetId: z.string().uuid().optional().nullable(),
});

export async function savePublicDetailsAction(input: {
  propertyId: string;
  title: string;
  description: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  imageAssetIds?: string[];
  coverAssetId?: string | null;
}): Promise<ActionResult<{ listingStatus: string }>> {
  try {
    const parsed = publicDetailsSchema.parse(input);
    const context = await requireAccess();

    const result = await savePublicDetails(
      parsed.propertyId,
      {
        title: parsed.title,
        description: parsed.description,
        metaTitle: parsed.metaTitle ?? null,
        metaDescription: parsed.metaDescription ?? null,
        imageAssetIds: parsed.imageAssetIds,
        coverAssetId: parsed.coverAssetId ?? null,
      },
      context,
    );

    revalidateProperty(parsed.propertyId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/* ----------------------------------------------------------------- rooms */

const roomSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter a room name."),
  availabilityDate: z.string().optional().nullable(),
  rentFrequency: z.enum(["MONTHLY", "WEEKLY"]),
  rentPence: z.number().int().positive("Enter a rent greater than zero."),
  depositPence: z.number().int().nonnegative().optional().nullable(),
  commissionType: z.enum(["PERCENTAGE", "FIXED"]).optional().nullable(),
  commissionValue: z.number().int().nonnegative().optional().nullable(),
});

export async function addRoomAction(input: z.input<typeof roomSchema>): Promise<ActionResult> {
  try {
    const parsed = roomSchema.parse(input);
    const context = await requireAccess();

    await addRoom(
      parsed.propertyId,
      {
        name: parsed.name,
        availabilityDate: parsed.availabilityDate ?? null,
        rentFrequency: parsed.rentFrequency,
        rentPence: parsed.rentPence,
        depositPence: parsed.depositPence ?? null,
        commissionType: parsed.commissionType ?? null,
        commissionValue: parsed.commissionValue ?? null,
      },
      context,
    );

    revalidateProperty(parsed.propertyId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function updateRoomAction(input: {
  roomId: string;
  propertyId: string;
  name?: string;
  availabilityDate?: string | null;
  rentFrequency?: "MONTHLY" | "WEEKLY";
  rentPence?: number;
  depositPence?: number | null;
  commissionType?: "PERCENTAGE" | "FIXED" | null;
  commissionValue?: number | null;
  status?: "AVAILABLE" | "UNAVAILABLE";
}): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await updateRoom(input.roomId, input, context);
    revalidateProperty(input.propertyId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function removeRoomAction(
  roomId: string,
  propertyId: string,
): Promise<ActionResult> {
  try {
    const context = await requireAccess();
    await removeRoom(roomId, context);
    revalidateProperty(propertyId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
