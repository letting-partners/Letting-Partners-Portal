import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { serverEnv } from "@/lib/env";
import { db, type DbExecutor } from "@/db";
import {
  commissionRules,
  crossSellSplits,
  exchangeRates,
  systemSettings,
  userCommissionRules,
} from "@/db/schema";
import type { CommissionRuleSnapshot, CrossSellSplitSnapshot } from "./commission-engine";

/**
 * Reads the live configuration that drives money and routing.
 *
 * Everything here returns a *snapshot* - a plain value copied at the moment of
 * use. Closing a sale stores those snapshots, so editing a rule tomorrow can
 * never rewrite a sale that completed today.
 */

export const DEFAULT_FRONTER_RULE: CommissionRuleSnapshot = { type: "PERCENTAGE", value: 1000 };
export const DEFAULT_AGENT_RULE: CommissionRuleSnapshot = { type: "PERCENTAGE", value: 5000 };
export const DEFAULT_CROSS_SELL_SPLIT: CrossSellSplitSnapshot = {
  propertyAgentBp: 6000,
  tenantAgentBp: 4000,
};
export const DEFAULT_PKR_RATE_X100 = 36_900;

/** The global default rule for a scope, or the built-in default if unset. */
export async function getGlobalCommissionRule(
  scope: "FRONTER" | "AGENT",
  executor: DbExecutor = db,
): Promise<CommissionRuleSnapshot> {
  const rows = await executor
    .select({ type: commissionRules.commissionType, value: commissionRules.value })
    .from(commissionRules)
    .where(and(eq(commissionRules.scope, scope), isNull(commissionRules.effectiveTo)))
    .limit(1);

  const row = rows[0];
  if (row) return { type: row.type, value: row.value };
  return scope === "FRONTER" ? DEFAULT_FRONTER_RULE : DEFAULT_AGENT_RULE;
}

/**
 * The rule that applies to one person: their individual override if they have
 * a live one, otherwise the global default for their scope.
 */
export async function getEffectiveCommissionRule(
  userId: string | null,
  scope: "FRONTER" | "AGENT",
  executor: DbExecutor = db,
): Promise<CommissionRuleSnapshot | null> {
  if (!userId) return null;

  const overrides = await executor
    .select({ type: userCommissionRules.commissionType, value: userCommissionRules.value })
    .from(userCommissionRules)
    .where(and(eq(userCommissionRules.userId, userId), isNull(userCommissionRules.effectiveTo)))
    .limit(1);

  const override = overrides[0];
  if (override) return { type: override.type, value: override.value };

  return getGlobalCommissionRule(scope, executor);
}

export async function getCrossSellSplit(
  executor: DbExecutor = db,
): Promise<CrossSellSplitSnapshot> {
  const rows = await executor
    .select({
      propertyAgentBp: crossSellSplits.propertyAgentBp,
      tenantAgentBp: crossSellSplits.tenantAgentBp,
    })
    .from(crossSellSplits)
    .where(isNull(crossSellSplits.effectiveTo))
    .limit(1);

  return rows[0] ?? DEFAULT_CROSS_SELL_SPLIT;
}

/** Latest GBP to PKR rate, stored x100. Used for commission display only. */
export async function getExchangeRateX100(executor: DbExecutor = db): Promise<number> {
  const rows = await executor
    .select({ rateX100: exchangeRates.rateX100 })
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.createdAt))
    .limit(1);

  return rows[0]?.rateX100 ?? DEFAULT_PKR_RATE_X100;
}

export async function getExchangeRateDetail(executor: DbExecutor = db) {
  const rows = await executor
    .select()
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.createdAt))
    .limit(1);

  const row = rows[0];
  return {
    rateX100: row?.rateX100 ?? DEFAULT_PKR_RATE_X100,
    updatedAt: row?.createdAt ?? null,
    updatedById: row?.updatedById ?? null,
    source: row?.source ?? "DEFAULT",
    isDefault: !row,
  };
}

/**
 * Supersede a global rule: close the current row, open a new one. History is
 * kept so a past sale can always be explained.
 */
export async function replaceGlobalCommissionRule(
  scope: "FRONTER" | "AGENT",
  rule: CommissionRuleSnapshot,
  userId: string,
  note: string | null,
  executor: DbExecutor = db,
): Promise<void> {
  const now = new Date();
  await executor
    .update(commissionRules)
    .set({ effectiveTo: now })
    .where(and(eq(commissionRules.scope, scope), isNull(commissionRules.effectiveTo)));

  await executor.insert(commissionRules).values({
    scope,
    commissionType: rule.type,
    value: rule.value,
    effectiveFrom: now,
    createdById: userId,
    note,
  });
}

export async function replaceUserCommissionRule(
  targetUserId: string,
  rule: CommissionRuleSnapshot | null,
  actorId: string,
  note: string | null,
  executor: DbExecutor = db,
): Promise<void> {
  const now = new Date();
  await executor
    .update(userCommissionRules)
    .set({ effectiveTo: now })
    .where(
      and(eq(userCommissionRules.userId, targetUserId), isNull(userCommissionRules.effectiveTo)),
    );

  // A null rule removes the override so the global default applies again.
  if (!rule) return;

  await executor.insert(userCommissionRules).values({
    userId: targetUserId,
    commissionType: rule.type,
    value: rule.value,
    effectiveFrom: now,
    createdBy: actorId,
    note,
  });
}

export async function replaceCrossSellSplit(
  split: CrossSellSplitSnapshot,
  userId: string,
  executor: DbExecutor = db,
): Promise<void> {
  if (split.propertyAgentBp + split.tenantAgentBp !== 10_000) {
    throw new Error("The cross-sell split must total 100%.");
  }

  const now = new Date();
  await executor
    .update(crossSellSplits)
    .set({ effectiveTo: now })
    .where(isNull(crossSellSplits.effectiveTo));

  await executor.insert(crossSellSplits).values({
    propertyAgentBp: split.propertyAgentBp,
    tenantAgentBp: split.tenantAgentBp,
    effectiveFrom: now,
    createdById: userId,
  });
}

export async function setExchangeRate(
  rateX100: number,
  userId: string,
  source = "MANUAL",
  executor: DbExecutor = db,
): Promise<void> {
  if (!Number.isInteger(rateX100) || rateX100 <= 0) {
    throw new Error("The exchange rate must be a positive number.");
  }
  await executor.insert(exchangeRates).values({ rateX100, updatedById: userId, source });
}

/* ---------------------------------------------------------- key/value bag */

export const SETTING_KEYS = {
  companyName: "company.name",
  companyPhone: "company.phone",
  companyEmail: "company.email",
  chatRouting: "chat.routing",
  propertyDefaults: "property.defaults",
  websiteUrl: "urls.website",
  portalUrl: "urls.portal",
} as const;

/** Where the address lookup key lives when it is set in the portal. */
export const ADDRESS_API_KEY_SETTING = "integrations.address_api_key";

/**
 * The address lookup key, preferring the one saved in the portal.
 *
 * A key with a monthly lookup allowance runs out at the worst possible moment,
 * so an administrator can paste a replacement in settings without a deploy.
 * The environment variable stays as the fallback for a fresh install.
 */
export async function getAddressApiKey(executor: DbExecutor = db): Promise<string | null> {
  const stored = await getSetting<string | null>(ADDRESS_API_KEY_SETTING, null, executor);
  if (stored?.trim()) return stored.trim();

  try {
    return serverEnv().ADDRESS_API_KEY?.trim() || null;
  } catch {
    return null;
  }
}

export async function getSetting<T>(
  key: string,
  fallback: T,
  executor: DbExecutor = db,
): Promise<T> {
  const rows = await executor
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);

  return (rows[0]?.value as T) ?? fallback;
}

export async function setSetting(
  key: string,
  value: unknown,
  userId: string,
  description?: string,
  executor: DbExecutor = db,
): Promise<void> {
  await executor
    .insert(systemSettings)
    .values({
      key,
      value: value as never,
      updatedById: userId,
      description: description ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: value as never, updatedById: userId, updatedAt: new Date() },
    });
}
