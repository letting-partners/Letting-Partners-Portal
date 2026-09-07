import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import {
  followUps,
  landlords,
  notInterestedRecords,
  properties,
  users,
} from "@/db/schema";
import {
  normalizeUKPhoneDetailed,
  PHONE_ERROR_MESSAGES,
  type PhoneNormalizationError,
} from "@/lib/phone";
import {
  canOverrideFollowUpLock,
  canRetryFollowUp,
  canViewLandlord,
  type AccessContext,
} from "./permissions";

/**
 * The one place that answers "who owns this number?".
 *
 * Every entry point into the call workflow goes through `lookupPhone`, so the
 * ownership, follow-up lock and not-interested rules can never be bypassed by
 * a caller that forgot to check one of them.
 *
 * Precedence is deliberate:
 *   1. an existing landlord      - the number is already a customer
 *   2. a scheduled follow-up     - the number is locked to a colleague
 *   3. a not-interested record   - callable, but show the history first
 *   4. available
 */

export type PhoneLookupResult =
  | { kind: "INVALID"; message: string; reason: PhoneNormalizationError }
  | { kind: "AVAILABLE"; normalizedPhone: string; originalPhone: string }
  | {
      kind: "EXISTING_LANDLORD";
      normalizedPhone: string;
      originalPhone: string;
      landlord: {
        id: string;
        name: string;
        displayPhone: string;
        email: string | null;
        propertyCount: number;
        lastContactAt: Date | null;
        createdAt: Date;
      };
      fronter: PersonSummary | null;
      agent: PersonSummary | null;
      /** False when the landlord belongs to a team this user cannot see. */
      canView: boolean;
    }
  | {
      kind: "FOLLOW_UP_LOCKED";
      normalizedPhone: string;
      originalPhone: string;
      followUp: {
        id: string;
        contactName: string | null;
        dueAt: Date;
        priority: "LOW" | "NORMAL" | "HIGH";
        lastNote: string;
        reason: string | null;
      };
      owner: PersonSummary | null;
      agent: PersonSummary | null;
      /** True when this user owns the follow-up. */
      isOwner: boolean;
      /** True when this user may continue the call (owner, or override). */
      canRetry: boolean;
      /** True when continuing would be an audited override of someone else. */
      requiresOverride: boolean;
    }
  | {
      kind: "NOT_INTERESTED";
      normalizedPhone: string;
      originalPhone: string;
      record: {
        id: string;
        contactName: string | null;
        reason: string;
        notes: string | null;
        createdAt: Date;
      };
      attempts: number;
      lastAttemptBy: PersonSummary | null;
      agent: PersonSummary | null;
    };

export type PersonSummary = {
  id: string;
  fullName: string;
  role: "SUPER_ADMIN" | "AGENT" | "FRONTER";
  avatarUrl: string | null;
};

function personFrom(row: {
  id: string | null;
  fullName: string | null;
  role: PersonSummary["role"] | null;
  avatarUrl: string | null;
}): PersonSummary | null {
  if (!row.id || !row.fullName || !row.role) return null;
  return { id: row.id, fullName: row.fullName, role: row.role, avatarUrl: row.avatarUrl };
}

/**
 * Look a number up across every ownership surface.
 *
 * `context` decides only what is *shown*, never what is *found* - a fronter is
 * always told a number is taken, but is not shown records they cannot access.
 */
export async function lookupPhone(
  rawPhone: string,
  context: AccessContext,
  executor: DbExecutor = db,
): Promise<PhoneLookupResult> {
  const normalization = normalizeUKPhoneDetailed(rawPhone);
  if (!normalization.ok) {
    return {
      kind: "INVALID",
      reason: normalization.reason,
      message: PHONE_ERROR_MESSAGES[normalization.reason],
    };
  }

  const normalizedPhone = normalization.normalized;
  const originalPhone = normalization.original;

  /* 1 -------------------------------------------------- existing landlord */

  const landlordRows = await executor
    .select({
      id: landlords.id,
      name: landlords.name,
      email: landlords.email,
      originalPhone: landlords.originalPhone,
      lastContactAt: landlords.lastContactAt,
      createdAt: landlords.createdAt,
      createdBy: landlords.createdBy,
      originatingFronterId: landlords.originatingFronterId,
      assignedAgentId: landlords.assignedAgentId,
    })
    .from(landlords)
    .where(and(eq(landlords.normalizedPhone, normalizedPhone), isNull(landlords.deletedAt)))
    .limit(1);

  const landlord = landlordRows[0];
  if (landlord) {
    const [propertyCountRow] = await executor
      .select({ value: count() })
      .from(properties)
      .where(and(eq(properties.landlordId, landlord.id), isNull(properties.deletedAt)));

    const people = await loadPeople(executor, [
      landlord.originatingFronterId,
      landlord.assignedAgentId,
    ]);

    return {
      kind: "EXISTING_LANDLORD",
      normalizedPhone,
      originalPhone,
      landlord: {
        id: landlord.id,
        name: landlord.name,
        displayPhone: landlord.originalPhone,
        email: landlord.email,
        propertyCount: Number(propertyCountRow?.value ?? 0),
        lastContactAt: landlord.lastContactAt,
        createdAt: landlord.createdAt,
      },
      fronter: people.get(landlord.originatingFronterId ?? "") ?? null,
      agent: people.get(landlord.assignedAgentId ?? "") ?? null,
      canView: canViewLandlord(context, landlord),
    };
  }

  /* 2 --------------------------------------------------- follow-up lock */

  const followUpRows = await executor
    .select()
    .from(followUps)
    .where(
      and(eq(followUps.normalizedPhone, normalizedPhone), eq(followUps.status, "SCHEDULED")),
    )
    .limit(1);

  const followUp = followUpRows[0];
  if (followUp) {
    const people = await loadPeople(executor, [followUp.createdById, followUp.agentId]);
    const isOwner = followUp.createdById === context.user.id;

    return {
      kind: "FOLLOW_UP_LOCKED",
      normalizedPhone,
      originalPhone,
      followUp: {
        id: followUp.id,
        contactName: followUp.contactName,
        dueAt: followUp.dueAt,
        priority: followUp.priority,
        lastNote: followUp.notes,
        reason: followUp.reason,
      },
      owner: people.get(followUp.createdById) ?? null,
      agent: people.get(followUp.agentId ?? "") ?? null,
      isOwner,
      canRetry: canRetryFollowUp(context, followUp),
      requiresOverride: !isOwner && canOverrideFollowUpLock(context, followUp),
    };
  }

  /* 3 ------------------------------------------------- previously refused */

  const notInterestedRows = await executor
    .select()
    .from(notInterestedRecords)
    .where(eq(notInterestedRecords.normalizedPhone, normalizedPhone))
    .orderBy(desc(notInterestedRecords.createdAt))
    .limit(1);

  const record = notInterestedRows[0];
  if (record) {
    const [attemptRow] = await executor
      .select({ value: count() })
      .from(notInterestedRecords)
      .where(eq(notInterestedRecords.normalizedPhone, normalizedPhone));

    const people = await loadPeople(executor, [record.createdById, record.agentId]);

    return {
      kind: "NOT_INTERESTED",
      normalizedPhone,
      originalPhone,
      record: {
        id: record.id,
        contactName: record.contactName,
        reason: record.reason,
        notes: record.notes,
        createdAt: record.createdAt,
      },
      attempts: Number(attemptRow?.value ?? 1),
      lastAttemptBy: people.get(record.createdById) ?? null,
      agent: people.get(record.agentId ?? "") ?? null,
    };
  }

  /* 4 ----------------------------------------------------------- free */

  return { kind: "AVAILABLE", normalizedPhone, originalPhone };
}

async function loadPeople(
  executor: DbExecutor,
  ids: (string | null)[],
): Promise<Map<string, PersonSummary>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const rows = await executor
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(inArray(users.id, unique));

  const map = new Map<string, PersonSummary>();
  for (const row of rows) {
    const person = personFrom(row);
    if (person) map.set(row.id, person);
  }
  return map;
}

/**
 * Server-side re-check used immediately before creating a landlord or
 * follow-up. Two fronters looking up the same unknown number at the same
 * moment both see "available"; this runs inside the write transaction so only
 * one of them can proceed.
 */
export async function assertPhoneClaimable(
  normalizedPhone: string,
  context: AccessContext,
  executor: DbExecutor,
): Promise<void> {
  const result = await lookupPhone(normalizedPhone, context, executor);

  if (result.kind === "EXISTING_LANDLORD") {
    throw new PhoneUnavailableError(
      "This number already belongs to a landlord on the system.",
      result,
    );
  }

  if (result.kind === "FOLLOW_UP_LOCKED" && !result.isOwner && !result.canRetry) {
    throw new PhoneUnavailableError(
      "Another user has an active follow-up on this number.",
      result,
    );
  }
}

export class PhoneUnavailableError extends Error {
  readonly lookup: PhoneLookupResult;

  constructor(message: string, lookup: PhoneLookupResult) {
    super(message);
    this.name = "PhoneUnavailableError";
    this.lookup = lookup;
  }
}

/** Sentence describing an unavailable number, used in modals and toasts. */
export function describeLookup(result: PhoneLookupResult): string {
  switch (result.kind) {
    case "INVALID":
      return result.message;
    case "AVAILABLE":
      return "This number is not on the system. You can start a call.";
    case "EXISTING_LANDLORD":
      return `${result.landlord.name} is already a landlord on the system.`;
    case "FOLLOW_UP_LOCKED":
      return result.isOwner
        ? "You have an active follow-up on this number."
        : `${result.owner?.fullName ?? "Another user"} has an active follow-up on this number.`;
    case "NOT_INTERESTED":
      return `This number was marked not interested by ${result.lastAttemptBy?.fullName ?? "a colleague"}.`;
  }
}
