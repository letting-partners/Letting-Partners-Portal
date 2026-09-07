import "server-only";
import { db, type DbExecutor } from "@/db";
import { activities, auditLog } from "@/db/schema";
import type { activityTypeEnum, auditActionEnum } from "@/db/schema";
import { clientIp, clientUserAgent } from "@/lib/auth/session";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Audit and activity writing. Both tables are append-only.
 *
 *  - `auditLog`     compliance record: who changed what, before and after.
 *  - `activities`   human timeline shown on record pages.
 *
 * Both accept an executor so they can join the same transaction as the change
 * they describe: if the business write rolls back, its trail rolls back too.
 */

type AuditAction = (typeof auditActionEnum.enumValues)[number];
type ActivityType = (typeof activityTypeEnum.enumValues)[number];

export type AuditInput = {
  user: Pick<SessionUser, "id" | "fullName" | "email"> | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export async function recordAudit(input: AuditInput, executor: DbExecutor = db): Promise<void> {
  await executor.insert(auditLog).values({
    userId: input.user?.id ?? null,
    userLabel: input.user ? `${input.user.fullName} <${input.user.email}>` : null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    entityLabel: input.entityLabel ?? null,
    before: (input.before ?? null) as never,
    after: (input.after ?? null) as never,
    metadata: (input.metadata ?? null) as never,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
}

/**
 * Convenience wrapper that fills in the request IP and user agent. Only usable
 * from a request context; background jobs call `recordAudit` directly.
 */
export async function auditFromRequest(
  input: Omit<AuditInput, "ip" | "userAgent">,
  executor: DbExecutor = db,
): Promise<void> {
  await recordAudit(
    { ...input, ip: await clientIp(), userAgent: await clientUserAgent() },
    executor,
  );
}

export type ActivityInput = {
  type: ActivityType;
  entityType: string;
  entityId: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  actorId: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
};

export async function recordActivity(
  input: ActivityInput,
  executor: DbExecutor = db,
): Promise<void> {
  await executor.insert(activities).values({
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    actorId: input.actorId,
    summary: input.summary,
    metadata: (input.metadata ?? null) as never,
  });
}

/** Insert several timeline entries from one workflow in a single round trip. */
export async function recordActivities(
  inputs: ActivityInput[],
  executor: DbExecutor = db,
): Promise<void> {
  if (inputs.length === 0) return;
  await executor.insert(activities).values(
    inputs.map((input) => ({
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      actorId: input.actorId,
      summary: input.summary,
      metadata: (input.metadata ?? null) as never,
    })),
  );
}

export const ENTITY = {
  user: "User",
  landlord: "Landlord",
  property: "Property",
  propertyRoom: "PropertyRoom",
  tenant: "Tenant",
  call: "Call",
  followUp: "FollowUp",
  notInterested: "NotInterestedRecord",
  deal: "Deal",
  viewing: "Viewing",
  verification: "Verification",
  closing: "Closing",
  sale: "Sale",
  collaboration: "Collaboration",
  commissionRule: "CommissionRule",
  exchangeRate: "ExchangeRate",
  settings: "SystemSetting",
  conversation: "CustomerConversation",
  image: "ImageAsset",
} as const;
