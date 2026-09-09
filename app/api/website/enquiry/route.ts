import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, verifyWebsiteApiKey, withCors } from "@/lib/api-auth";
import { ChatError, startCustomerConversation } from "@/services/chat";

/**
 * POST /api/website/enquiry
 *
 * Any form on the public website. Each becomes a customer conversation, which
 * is how it reaches the team: the customer inbox already lists unassigned
 * threads to every agent and notifies the admins, so an enquiry can be
 * answered in the portal rather than read once in somebody's email and lost.
 *
 * The website keeps sending its own emails. This is in addition, not instead.
 */

export const dynamic = "force-dynamic";

const FORM_LABELS: Record<string, string> = {
  contact: "Contact enquiry",
  "legal-support": "Legal support request",
  newsletter: "Newsletter signup",
  valuation: "Valuation request",
  landlord: "Landlord enquiry",
};

const schema = z.object({
  form: z.string().trim().min(1).max(40),
  name: z.string().trim().max(160).optional().nullable(),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  message: z.string().trim().max(8000).optional().nullable(),
  /** Extra form fields, appended to the message so nothing is dropped. */
  details: z.record(z.string(), z.string()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  const unauthorized = verifyWebsiteApiKey(request);
  if (unauthorized) return withCors(unauthorized, request.headers.get("origin"));

  const origin = request.headers.get("origin");

  try {
    const input = schema.parse(await request.json());
    const label = FORM_LABELS[input.form] ?? "Website enquiry";

    /*
     * Every field the form collected goes into the message body. A form the
     * portal does not know about is still recorded in full rather than having
     * its unfamiliar fields silently dropped.
     */
    const extras = Object.entries(input.details ?? {})
      .filter(([, value]) => value?.trim())
      .map(([key, value]) => `${key}: ${value.trim()}`);

    const body = [input.message?.trim(), extras.length > 0 ? extras.join("\n") : null]
      .filter(Boolean)
      .join("\n\n");

    const result = await startCustomerConversation({
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      subject: input.name ? `${label} - ${input.name}` : label,
      message: body || `${label} received from the website.`,
    });

    return withCors(NextResponse.json({ ok: true, ...result }), origin);
  } catch (error) {
    if (error instanceof ChatError) return withCors(jsonError(error.message, 400), origin);

    const issues = (error as { issues?: { message?: string }[] })?.issues;
    if (error instanceof Error && error.name === "ZodError" && Array.isArray(issues)) {
      return withCors(jsonError(issues[0]?.message ?? "Check the details.", 400), origin);
    }

    console.error("Website enquiry endpoint failed:", error);
    return withCors(jsonError("Unable to record the enquiry.", 500), origin);
  }
}
