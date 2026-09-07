import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, ne, or, sql as raw, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  agentFronterAssignments,
  auditLog,
  landlords,
  properties,
  userCommissionRules,
  users,
  type userRoleEnum,
} from "@/db/schema";
import { normalizeEmail } from "@/lib/auth/crypto";
import { revokeAllSessions } from "@/lib/auth/session";
import { normalizeUKPhone } from "@/lib/phone";
import { sendEmail } from "@/lib/email/client";
import { accountCreatedEmail } from "@/lib/email/templates";
import { ENTITY, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import { getEffectiveCommissionRule, replaceUserCommissionRule } from "./settings";
import type { CommissionRuleSnapshot } from "./commission-engine";
import { ForbiddenError, type AccessContext } from "./permissions";

/**
 * Staff accounts. Only an administrator may create or change one, and because
 * the portal has no passwords, creating a user *is* granting access - the new
 * address can immediately request a sign-in code.
 */

export type Role = (typeof userRoleEnum.enumValues)[number];

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type CreateUserInput = {
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
  jobTitle?: string | null;
  /** Required for a fronter: every fronter reports to exactly one agent. */
  assignedAgentId?: string | null;
  commissionRule?: CommissionRuleSnapshot | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
};

export async function createUser(
  input: CreateUserInput,
  context: AccessContext,
): Promise<{ id: string }> {
  if (!context.isAdmin) throw new ForbiddenError();
  if (!input.fullName.trim()) throw new UserError("Enter the person's name.");

  const email = normalizeEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new UserError("Enter a valid email address.");
  }

  if (input.role === "FRONTER" && !input.assignedAgentId) {
    throw new UserError("Choose the agent this fronter reports to.");
  }

  const existing = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(raw`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing[0]) {
    throw new UserError(
      existing[0].deletedAt
        ? "An archived account already uses that email. Restore it instead."
        : "An account already uses that email address.",
    );
  }

  const created = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({
        fullName: input.fullName.trim(),
        email,
        phone: input.phone?.trim() || null,
        normalizedPhone: input.phone ? normalizeUKPhone(input.phone) : null,
        role: input.role,
        jobTitle: input.jobTitle?.trim() || null,
        assignedAgentId: input.role === "FRONTER" ? input.assignedAgentId : null,
        publicPhone: input.publicPhone?.trim() || null,
        publicEmail: input.publicEmail?.trim() || null,
        status: "ACTIVE",
        createdBy: context.user.id,
      })
      .returning({ id: users.id });

    const user = inserted[0];

    if (input.role === "FRONTER" && input.assignedAgentId) {
      await tx.insert(agentFronterAssignments).values({
        fronterId: user.id,
        agentId: input.assignedAgentId,
        assignedBy: context.user.id,
        reason: "Account created",
      });
    }

    if (input.commissionRule) {
      await replaceUserCommissionRule(
        user.id,
        input.commissionRule,
        context.user.id,
        "Set at account creation",
        tx,
      );
    }

    await recordAudit(
      {
        user: context.user,
        action: "CREATE",
        entityType: ENTITY.user,
        entityId: user.id,
        entityLabel: `${input.fullName.trim()} <${email}>`,
        after: { role: input.role, assignedAgentId: input.assignedAgentId ?? null },
      },
      tx,
    );

    return user;
  });

  // Sent after the transaction commits, so a mail failure cannot roll back an
  // account that already exists.
  const message = accountCreatedEmail(input.fullName.trim(), input.role);
  await sendEmail({
    to: email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  return { id: created.id };
}

export type UpdateUserInput = {
  fullName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  role?: Role;
  assignedAgentId?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  publicBio?: string | null;
};

export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new UserError("That account no longer exists.");

  const nextRole = input.role ?? user.role;
  const nextAgentId =
    input.assignedAgentId === undefined ? user.assignedAgentId : input.assignedAgentId;

  if (nextRole === "FRONTER" && !nextAgentId) {
    throw new UserError("A fronter must report to an agent.");
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.fullName !== undefined) {
    if (!input.fullName.trim()) throw new UserError("Enter the person's name.");
    patch.fullName = input.fullName.trim();
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone?.trim() || null;
    patch.normalizedPhone = input.phone ? normalizeUKPhone(input.phone) : null;
  }
  if (input.jobTitle !== undefined) patch.jobTitle = input.jobTitle?.trim() || null;
  if (input.publicPhone !== undefined) patch.publicPhone = input.publicPhone?.trim() || null;
  if (input.publicEmail !== undefined) patch.publicEmail = input.publicEmail?.trim() || null;
  if (input.publicBio !== undefined) patch.publicBio = input.publicBio?.trim() || null;
  if (input.role !== undefined) patch.role = input.role;
  if (input.assignedAgentId !== undefined) {
    patch.assignedAgentId = nextRole === "FRONTER" ? nextAgentId : null;
  }

  await db.transaction(async (tx) => {
    await tx.update(users).set(patch).where(eq(users.id, userId));

    // Moving a fronter closes their current assignment and opens a new one.
    const agentChanged =
      nextRole === "FRONTER" && nextAgentId && nextAgentId !== user.assignedAgentId;

    if (agentChanged) {
      await tx
        .update(agentFronterAssignments)
        .set({ unassignedAt: new Date() })
        .where(
          and(
            eq(agentFronterAssignments.fronterId, userId),
            isNull(agentFronterAssignments.unassignedAt),
          ),
        );

      await tx.insert(agentFronterAssignments).values({
        fronterId: userId,
        agentId: nextAgentId,
        assignedBy: context.user.id,
        reason: "Reassigned by an administrator",
      });
    }

    await recordAudit(
      {
        user: context.user,
        action: agentChanged ? "REASSIGN" : "UPDATE",
        entityType: ENTITY.user,
        entityId: userId,
        entityLabel: user.email,
        before: {
          fullName: user.fullName,
          role: user.role,
          assignedAgentId: user.assignedAgentId,
        },
        after: patch,
      },
      tx,
    );
  });
}

/**
 * Deactivating revokes every live session immediately, so access ends the
 * moment the switch is flipped rather than when a cookie happens to expire.
 */
export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED",
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();
  if (userId === context.user.id) {
    throw new UserError("You cannot change your own account status.");
  }

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) throw new UserError("That account no longer exists.");

  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));

  if (status !== "ACTIVE") await revokeAllSessions(userId);

  await recordAudit({
    user: context.user,
    action: "PERMISSION_CHANGE",
    entityType: ENTITY.user,
    entityId: userId,
    entityLabel: user.email,
    before: { status: user.status },
    after: { status },
  });
}

export async function setUserCommissionRule(
  userId: string,
  rule: CommissionRuleSnapshot | null,
  note: string | null,
  context: AccessContext,
): Promise<void> {
  if (!context.isAdmin) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await replaceUserCommissionRule(userId, rule, context.user.id, note, tx);

    await recordAudit(
      {
        user: context.user,
        action: "COMMISSION_CHANGE",
        entityType: ENTITY.user,
        entityId: userId,
        after: rule ? { type: rule.type, value: rule.value } : { override: "removed" },
        metadata: { note },
      },
      tx,
    );
  });
}

/* ------------------------------------------------------------------ read */

export type UserListFilters = {
  search?: string;
  role?: Role;
  status?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
};

export async function listUsers(context: AccessContext, filters: UserListFilters = {}) {
  if (!context.isAdmin) throw new ForbiddenError();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

  const conditions: (SQL | undefined)[] = [];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(users.fullName, term), ilike(users.email, term)));
  }
  if (filters.role) conditions.push(eq(users.role, filters.role));
  if (filters.status) {
    conditions.push(eq(users.status, filters.status as typeof users.$inferSelect.status));
  }
  if (filters.agentId) conditions.push(eq(users.assignedAgentId, filters.agentId));

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        status: users.status,
        jobTitle: users.jobTitle,
        avatarUrl: users.avatarUrl,
        assignedAgentId: users.assignedAgentId,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(where)
      .orderBy(users.role, users.fullName)
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(users).where(where),
  ]);

  const people = await loadPeopleMap(rows.map((row) => row.assignedAgentId));

  return {
    rows: rows.map((row) => ({
      ...row,
      assignedAgent: row.assignedAgentId ? (people.get(row.assignedAgentId) ?? null) : null,
    })),
    total: Number(totalRows[0]?.value ?? 0),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(Number(totalRows[0]?.value ?? 0) / pageSize)),
  };
}

export async function getUserDetail(userId: string, context: AccessContext) {
  if (!context.isAdmin) throw new ForbiddenError();

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) return null;

  const [assignments, override, effectiveRule, counts, recentAudit, fronters] = await Promise.all([
    db
      .select()
      .from(agentFronterAssignments)
      .where(eq(agentFronterAssignments.fronterId, userId))
      .orderBy(desc(agentFronterAssignments.assignedAt)),

    db
      .select()
      .from(userCommissionRules)
      .where(
        and(eq(userCommissionRules.userId, userId), isNull(userCommissionRules.effectiveTo)),
      )
      .limit(1),

    getEffectiveCommissionRule(userId, user.role === "FRONTER" ? "FRONTER" : "AGENT"),

    Promise.all([
      db
        .select({ value: count() })
        .from(landlords)
        .where(
          and(
            isNull(landlords.deletedAt),
            or(
              eq(landlords.originatingFronterId, userId),
              eq(landlords.assignedAgentId, userId),
            ),
          ),
        ),
      db
        .select({ value: count() })
        .from(properties)
        .where(
          and(
            isNull(properties.deletedAt),
            or(
              eq(properties.originatingFronterId, userId),
              eq(properties.assignedAgentId, userId),
            ),
          ),
        ),
    ]),

    db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityLabel: auditLog.entityLabel,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .where(eq(auditLog.userId, userId))
      .orderBy(desc(auditLog.createdAt))
      .limit(20),

    user.role === "AGENT"
      ? db
          .select({ id: users.id, fullName: users.fullName, status: users.status })
          .from(users)
          .where(and(eq(users.assignedAgentId, userId), isNull(users.deletedAt)))
          .orderBy(users.fullName)
      : Promise.resolve([]),
  ]);

  const people = await loadPeopleMap([user.assignedAgentId, user.createdBy]);

  return {
    user,
    assignments,
    commissionOverride: override[0] ?? null,
    effectiveRule,
    landlordCount: Number(counts[0][0]?.value ?? 0),
    propertyCount: Number(counts[1][0]?.value ?? 0),
    recentAudit,
    fronters,
    assignedAgent: user.assignedAgentId ? (people.get(user.assignedAgentId) ?? null) : null,
    creator: user.createdBy ? (people.get(user.createdBy) ?? null) : null,
  };
}

/** Agents available to manage a fronter. */
export async function listAgents() {
  return db
    .select({ id: users.id, fullName: users.fullName, role: users.role })
    .from(users)
    .where(
      and(
        inArray(users.role, ["AGENT", "SUPER_ADMIN"]),
        isNull(users.deletedAt),
        eq(users.status, "ACTIVE"),
      ),
    )
    .orderBy(users.fullName);
}

/* ------------------------------------------------------------ own profile */

export type ProfileInput = {
  fullName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  publicPhone?: string | null;
  publicEmail?: string | null;
  publicBio?: string | null;
  themePreference?: "LIGHT" | "DARK" | "SYSTEM";
  notificationPreferences?: {
    emailFollowUpReminders: boolean;
    emailMissedCustomerChat: boolean;
    inAppSound: boolean;
  };
};

/**
 * What a user may change about themselves. Deliberately excludes role, status,
 * email and team assignment - those are identity, and only an admin sets them.
 */
export async function updateOwnProfile(
  input: ProfileInput,
  context: AccessContext,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (input.fullName !== undefined) {
    if (!input.fullName.trim()) throw new UserError("Enter your name.");
    patch.fullName = input.fullName.trim();
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone?.trim() || null;
    patch.normalizedPhone = input.phone ? normalizeUKPhone(input.phone) : null;
  }
  if (input.jobTitle !== undefined) patch.jobTitle = input.jobTitle?.trim() || null;
  if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
  if (input.publicPhone !== undefined) patch.publicPhone = input.publicPhone?.trim() || null;
  if (input.publicEmail !== undefined) patch.publicEmail = input.publicEmail?.trim() || null;
  if (input.publicBio !== undefined) patch.publicBio = input.publicBio?.trim() || null;
  if (input.themePreference !== undefined) patch.themePreference = input.themePreference;
  if (input.notificationPreferences !== undefined) {
    patch.notificationPreferences = input.notificationPreferences;
  }

  await db.update(users).set(patch).where(eq(users.id, context.user.id));
}

/* ---------------------------------------------------------------- audit */

export type AuditFilters = {
  search?: string;
  action?: string;
  entityType?: string;
  userId?: string;
  page?: number;
  pageSize?: number;
};

export async function listAuditLog(context: AccessContext, filters: AuditFilters = {}) {
  if (!context.isAdmin) throw new ForbiddenError();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 50, 1), 200);

  const conditions: (SQL | undefined)[] = [];

  if (filters.search) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(auditLog.entityLabel, term), ilike(auditLog.userLabel, term)));
  }
  if (filters.action) {
    conditions.push(eq(auditLog.action, filters.action as typeof auditLog.$inferSelect.action));
  }
  if (filters.entityType) conditions.push(eq(auditLog.entityType, filters.entityType));
  if (filters.userId) conditions.push(eq(auditLog.userId, filters.userId));

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db.select({ value: count() }).from(auditLog).where(where),
  ]);

  return {
    rows,
    total: Number(totalRows[0]?.value ?? 0),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(Number(totalRows[0]?.value ?? 0) / pageSize)),
  };
}

/** Everyone who has ever written an audit entry, for the filter dropdown. */
export async function listAuditActors() {
  return db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(isNull(users.deletedAt), ne(users.status, "INACTIVE")))
    .orderBy(users.fullName);
}
