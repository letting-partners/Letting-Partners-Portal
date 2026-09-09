"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { genderEnum } from "@/db/schema";
import { ForbiddenError, requireAccess, requireAdmin } from "@/services/permissions";
import { archiveLandlord, LandlordError, restoreLandlord, updateLandlord } from "@/services/landlords";

/**
 * Row actions for the landlords table.
 *
 * Editing follows the service's own permission rule, so an agent can correct
 * their own landlord. Removal is admin only, and is an archive rather than a
 * delete: the row stays, flagged and attributed, because the call history that
 * points at it must not develop holes.
 */

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof LandlordError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Landlord action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const updateSchema = z.object({
  landlordId: z.string().uuid(),
  name: z.string().trim().min(1, "Enter the landlord name.").max(160),
  email: z.string().trim().max(254).optional().nullable(),
  alternatePhone: z.string().trim().max(32).optional().nullable(),
  gender: z.enum(genderEnum.enumValues),
});

export async function updateLandlordAction(
  input: z.input<typeof updateSchema>,
): Promise<ActionResult> {
  try {
    const parsed = updateSchema.parse(input);

    if (parsed.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parsed.email)) {
      return { ok: false, error: "Enter a valid email address, or leave it blank." };
    }

    const context = await requireAccess();
    await updateLandlord(
      parsed.landlordId,
      {
        name: parsed.name,
        email: parsed.email || null,
        alternatePhone: parsed.alternatePhone || null,
        gender: parsed.gender,
      },
      context,
    );

    revalidatePath("/landlords");
    revalidatePath(`/landlords/${parsed.landlordId}`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveLandlordAction(landlordId: string): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await archiveLandlord(landlordId, context);
    revalidatePath("/landlords");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function restoreLandlordAction(landlordId: string): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await restoreLandlord(landlordId, context);
    revalidatePath("/landlords");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
