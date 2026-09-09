import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { registerTenantFromWebsite, TenantError } from "@/services/tenants";

/**
 * POST /api/website/tenant-registration
 *
 * A tenant registering on the public website. The site still sends its own
 * emails; this is what puts the lead in front of the team, where it can be
 * assigned, matched and followed up rather than sitting in an inbox.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(160),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().min(1, "Enter a phone number.").max(32),
  area: z.string().trim().max(120).optional().nullable(),
  requirements: z.string().trim().max(4000).optional().nullable(),
  /** Pounds per month, as the website collects it. */
  maxBudget: z.coerce.number().int().nonnegative().optional().nullable(),
  moveInDate: z.string().trim().max(40).optional().nullable(),
  propertyType: z.enum(["HOUSE", "FLAT", "STUDIO_FLAT"]).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const origin = request.headers.get("origin");

  try {
    const input = schema.parse(await request.json());

    const result = await registerTenantFromWebsite({
      name: input.name,
      email: input.email ?? null,
      phone: input.phone,
      area: input.area ?? null,
      requirements: input.requirements ?? null,
      maxBudgetPence: input.maxBudget ? input.maxBudget * 100 : null,
      moveInDate: input.moveInDate || null,
      propertyTypePreference: input.propertyType ?? null,
    });

    return withCors(NextResponse.json({ ok: true, ...result }), origin);
  } catch (error) {
    if (error instanceof TenantError) {
      return withCors(jsonError(error.message, 400), origin);
    }
    const issues = (error as { issues?: { message?: string }[] })?.issues;
    if (error instanceof Error && error.name === "ZodError" && Array.isArray(issues)) {
      return withCors(jsonError(issues[0]?.message ?? "Check the details.", 400), origin);
    }

    console.error("Tenant registration endpoint failed:", error);
    return withCors(jsonError("Unable to record the registration.", 500), origin);
  }
}
