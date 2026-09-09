"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAgentOrAdmin } from "@/services/permissions";
import { archiveTenant, createTenant, TenantError, updateTenant } from "@/services/tenants";

/** Tenant actions. Fronters have no tenant access, so these require an agent. */

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof TenantError) return { ok: false, error: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "You do not have permission to do that." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the details and try again." };
  }
  console.error("Tenant action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const tenantSchema = z.object({
  name: z.string().trim().min(1, "Enter the tenant name.").max(160),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().min(1, "Enter a phone number."),
  area: z.string().trim().max(160).optional().nullable(),
  postcodePreferences: z.string().trim().max(200).optional().nullable(),
  requirements: z.string().trim().max(2000).optional().nullable(),
  minBudgetPence: z.number().int().nonnegative().optional().nullable(),
  maxBudgetPence: z.number().int().nonnegative().optional().nullable(),
  moveInDate: z.string().optional().nullable(),
  propertyTypePreference: z.enum(["HOUSE", "FLAT", "STUDIO_FLAT"]).optional().nullable(),
  bedrooms: z.number().int().nonnegative().optional().nullable(),

  /* Portal-only fields. The website form does not collect these. */
  roomType: z.string().trim().max(80).optional().nullable(),
  occupants: z.string().trim().max(40).optional().nullable(),
  monthlyIncomePence: z.number().int().nonnegative().optional().nullable(),
  occupation: z.string().trim().max(160).optional().nullable(),
  countryOfOrigin: z.string().trim().max(120).optional().nullable(),
});

export async function createTenantAction(
  input: z.input<typeof tenantSchema>,
): Promise<ActionResult<{ tenantId: string }>> {
  try {
    const parsed = tenantSchema.parse(input);
    const context = await requireAgentOrAdmin();
    const tenant = await createTenant(parsed, context);
    revalidatePath("/tenants");
    return { ok: true, data: { tenantId: tenant.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function updateTenantAction(
  tenantId: string,
  input: Partial<z.input<typeof tenantSchema>> & { status?: string },
): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await updateTenant(
      tenantId,
      {
        ...input,
        status: input.status as never,
      },
      context,
    );
    revalidatePath("/tenants");
    revalidatePath(`/tenants/${tenantId}`);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

export async function archiveTenantAction(tenantId: string): Promise<ActionResult> {
  try {
    const context = await requireAgentOrAdmin();
    await archiveTenant(tenantId, context);
    revalidatePath("/tenants");
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}
