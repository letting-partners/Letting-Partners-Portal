import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { commissionTypeEnum, themePreferenceEnum, userRoleEnum, userStatusEnum } from "./enums";

export type NotificationPreferences = {
  emailFollowUpReminders: boolean;
  emailMissedCustomerChat: boolean;
  inAppSound: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailFollowUpReminders: true,
  emailMissedCustomerChat: true,
  inAppSound: true,
};

const NOTIFICATION_PREFERENCES_DEFAULT_SQL = sql`'{"emailFollowUpReminders":true,"emailMissedCustomerChat":true,"inAppSound":true}'::jsonb`;

/**
 * Internal staff accounts. Only records that exist here can obtain an OTP,
 * which is how the portal stays closed to the public.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    normalizedPhone: varchar("normalized_phone", { length: 16 }),
    role: userRoleEnum("role").notNull(),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    jobTitle: varchar("job_title", { length: 120 }),
    avatarUrl: text("avatar_url"),

    assignedAgentId: uuid("assigned_agent_id"),

    themePreference: themePreferenceEnum("theme_preference").notNull().default("SYSTEM"),
    notificationPreferences: jsonb("notification_preferences")
      .$type<NotificationPreferences>()
      .notNull()
      .default(NOTIFICATION_PREFERENCES_DEFAULT_SQL),

    publicPhone: varchar("public_phone", { length: 32 }),
    publicEmail: varchar("public_email", { length: 254 }),
    publicBio: text("public_bio"),

    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.status),
    index("users_assigned_agent_idx").on(t.assignedAgentId),
  ],
);

/**
 * Immutable record of which agent a fronter reported to, and when. Reassigning
 * a fronter closes the current row and opens a new one; nothing is overwritten.
 */
export const agentFronterAssignments = pgTable(
  "agent_fronter_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fronterId: uuid("fronter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => users.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    unassignedAt: timestamp("unassigned_at", { withTimezone: true }),
    reason: text("reason"),
  },
  (t) => [
    index("afa_fronter_idx").on(t.fronterId),
    index("afa_agent_idx").on(t.agentId),
    uniqueIndex("afa_active_unique")
      .on(t.fronterId)
      .where(sql`${t.unassignedAt} is null`),
  ],
);

/** Per-user commission override. Absence means the global default applies. */
export const userCommissionRules = pgTable(
  "user_commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commissionType: commissionTypeEnum("commission_type").notNull(),
    /** Basis points when PERCENTAGE (1000 = 10.00%), pence when FIXED. */
    value: integer("value").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [
    index("ucr_user_idx").on(t.userId),
    uniqueIndex("ucr_active_unique")
      .on(t.userId)
      .where(sql`${t.effectiveTo} is null`),
  ],
);

/* ------------------------------------------------------------------- auth */

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull(),
    codeHash: varchar("code_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    requestIp: varchar("request_ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("otp_email_idx").on(sql`lower(${t.email})`),
    index("otp_expires_idx").on(t.expiresAt),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: varchar("ip", { length: 64 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sessions_token_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
    index("sessions_expires_idx").on(t.expiresAt),
  ],
);

/** Generic fixed-window counter backing OTP request and verify throttling. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: varchar("key", { length: 200 }).primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
  },
  (t) => [index("rate_limits_window_idx").on(t.windowStartedAt)],
);

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ one, many }) => ({
  assignedAgent: one(users, {
    fields: [users.assignedAgentId],
    references: [users.id],
    relationName: "agentFronters",
  }),
  fronters: many(users, { relationName: "agentFronters" }),
  assignmentHistory: many(agentFronterAssignments, { relationName: "fronterAssignments" }),
  commissionRules: many(userCommissionRules),
  sessions: many(sessions),
}));

export const agentFronterAssignmentsRelations = relations(agentFronterAssignments, ({ one }) => ({
  fronter: one(users, {
    fields: [agentFronterAssignments.fronterId],
    references: [users.id],
    relationName: "fronterAssignments",
  }),
  agent: one(users, {
    fields: [agentFronterAssignments.agentId],
    references: [users.id],
  }),
}));

export const userCommissionRulesRelations = relations(userCommissionRules, ({ one }) => ({
  user: one(users, { fields: [userCommissionRules.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type AgentFronterAssignment = typeof agentFronterAssignments.$inferSelect;
export type UserCommissionRule = typeof userCommissionRules.$inferSelect;
