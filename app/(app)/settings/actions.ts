"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ForbiddenError, requireAdmin } from "@/services/permissions";
import { ENTITY, recordAudit } from "@/services/audit";
import {
  replaceCrossSellSplit,
  replaceGlobalCommissionRule,
  setExchangeRate,
  setSetting,
} from "@/services/settings";

/** Administrator settings. Every change is audited. */

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof ForbiddenError) {
    return { ok: false, error: "Only an administrator can change settings." };
  }
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? "Check the values and try again." };
  }
  if (error instanceof Error) return { ok: false, error: error.message };
  console.error("Settings action failed:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

const ruleSchema = z.object({
  scope: z.enum(["FRONTER", "AGENT"]),
  type: z.enum(["PERCENTAGE", "FIXED"]),
  /** Basis points when a percentage, pence when fixed. */
  value: z.number().int().nonnegative(),
  note: z.string().trim().max(300).optional().nullable(),
});

export async function saveCommissionRuleAction(
  input: z.input<typeof ruleSchema>,
): Promise<ActionResult> {
  try {
    const parsed = ruleSchema.parse(input);

    if (parsed.type === "PERCENTAGE" && parsed.value > 10_000) {
      return { ok: false, error: "A percentage commission cannot be more than 100%." };
    }

    const context = await requireAdmin();

    await replaceGlobalCommissionRule(
      parsed.scope,
      { type: parsed.type, value: parsed.value },
      context.user.id,
      parsed.note ?? null,
    );

    await recordAudit({
      user: context.user,
      action: "COMMISSION_CHANGE",
      entityType: ENTITY.commissionRule,
      entityLabel: parsed.scope,
      after: { type: parsed.type, value: parsed.value },
      metadata: { note: parsed.note },
    });

    revalidatePath("/settings/commissions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveCrossSellSplitAction(
  propertyAgentBp: number,
  tenantAgentBp: number,
): Promise<ActionResult> {
  try {
    if (propertyAgentBp + tenantAgentBp !== 10_000) {
      return { ok: false, error: "The two shares must add up to 100%." };
    }

    const context = await requireAdmin();
    await replaceCrossSellSplit({ propertyAgentBp, tenantAgentBp }, context.user.id);

    await recordAudit({
      user: context.user,
      action: "COMMISSION_CHANGE",
      entityType: ENTITY.commissionRule,
      entityLabel: "Cross-sell split",
      after: { propertyAgentBp, tenantAgentBp },
    });

    revalidatePath("/settings/commissions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveExchangeRateAction(rate: number): Promise<ActionResult> {
  try {
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, error: "Enter a positive exchange rate." };
    }

    const context = await requireAdmin();
    const rateX100 = Math.round(rate * 100);
    await setExchangeRate(rateX100, context.user.id);

    await recordAudit({
      user: context.user,
      action: "UPDATE",
      entityType: ENTITY.exchangeRate,
      entityLabel: "GBP to PKR",
      after: { rateX100 },
    });

    revalidatePath("/settings");
    revalidatePath("/settings/commissions");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function saveSettingAction(key: string, value: string): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    await setSetting(key, value, context.user.id);

    await recordAudit({
      user: context.user,
      action: "UPDATE",
      entityType: ENTITY.settings,
      entityLabel: key,
      after: { value },
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}
