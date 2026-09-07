import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  callOutcomeEnum,
  callStatusEnum,
  followUpStatusEnum,
  notInterestedReasonEnum,
  priorityEnum,
} from "./enums";
import { landlords } from "./landlords";
import { users } from "./users";

/**
 * One row per call attempt. Rows are never deleted or rewritten: a retry always
 * inserts a new row with an incremented `attemptNumber` for that phone key, so
 * the full contact history for a number survives forever.
 */
export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalPhone: varchar("original_phone", { length: 32 }).notNull(),
    normalizedPhone: varchar("normalized_phone", { length: 16 }).notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),

    landlordId: uuid("landlord_id").references(() => landlords.id),
    /** Who made the call. */
    calledById: uuid("called_by_id")
      .notNull()
      .references(() => users.id),
    /** The agent the caller reported to at the time of the call. */
    agentId: uuid("agent_id").references(() => users.id),

    status: callStatusEnum("status").notNull().default("IN_PROGRESS"),
    outcome: callOutcomeEnum("outcome"),
    notes: text("notes"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),

    /** Set when a fronter continued an existing follow-up rather than cold calling. */
    followUpId: uuid("follow_up_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("calls_normalized_phone_idx").on(t.normalizedPhone),
    index("calls_called_by_idx").on(t.calledById),
    index("calls_agent_idx").on(t.agentId),
    index("calls_started_at_idx").on(t.startedAt),
    index("calls_outcome_idx").on(t.outcome),
    index("calls_landlord_idx").on(t.landlordId),
  ],
);

/**
 * A scheduled call-back. At most one SCHEDULED follow-up may exist per phone
 * key at a time - that partial unique index is the follow-up lock that stops
 * one fronter taking another fronter's prospect.
 */
export const followUps = pgTable(
  "follow_ups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callId: uuid("call_id").references(() => calls.id),
    landlordId: uuid("landlord_id").references(() => landlords.id),

    originalPhone: varchar("original_phone", { length: 32 }).notNull(),
    normalizedPhone: varchar("normalized_phone", { length: 16 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),

    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    priority: priorityEnum("priority").notNull().default("NORMAL"),
    reason: varchar("reason", { length: 200 }),
    notes: text("notes").notNull(),

    status: followUpStatusEnum("status").notNull().default("SCHEDULED"),

    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    agentId: uuid("agent_id").references(() => users.id),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id),
    convertedLandlordId: uuid("converted_landlord_id").references(() => landlords.id),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("follow_ups_active_phone_unique")
      .on(t.normalizedPhone)
      .where(sql`${t.status} = 'SCHEDULED'`),
    index("follow_ups_normalized_phone_idx").on(t.normalizedPhone),
    index("follow_ups_due_at_idx").on(t.dueAt),
    index("follow_ups_created_by_idx").on(t.createdById),
    index("follow_ups_agent_idx").on(t.agentId),
    index("follow_ups_status_idx").on(t.status),
  ],
);

/**
 * Append-only. A number can be marked not interested many times; the lookup
 * surfaces the most recent record together with the full attempt count.
 */
export const notInterestedRecords = pgTable(
  "not_interested_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callId: uuid("call_id").references(() => calls.id),
    originalPhone: varchar("original_phone", { length: 32 }).notNull(),
    normalizedPhone: varchar("normalized_phone", { length: 16 }).notNull(),
    contactName: varchar("contact_name", { length: 160 }),

    reason: notInterestedReasonEnum("reason").notNull(),
    notes: text("notes"),
    attemptNumber: integer("attempt_number").notNull().default(1),

    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    agentId: uuid("agent_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nir_normalized_phone_idx").on(t.normalizedPhone),
    index("nir_created_by_idx").on(t.createdById),
    index("nir_created_at_idx").on(t.createdAt),
  ],
);

export const callsRelations = relations(calls, ({ one }) => ({
  landlord: one(landlords, { fields: [calls.landlordId], references: [landlords.id] }),
  calledBy: one(users, { fields: [calls.calledById], references: [users.id] }),
  agent: one(users, { fields: [calls.agentId], references: [users.id], relationName: "callAgent" }),
  followUp: one(followUps, { fields: [calls.followUpId], references: [followUps.id] }),
}));

export const followUpsRelations = relations(followUps, ({ one }) => ({
  call: one(calls, { fields: [followUps.callId], references: [calls.id], relationName: "followUpCall" }),
  landlord: one(landlords, { fields: [followUps.landlordId], references: [landlords.id] }),
  createdBy: one(users, { fields: [followUps.createdById], references: [users.id] }),
  agent: one(users, {
    fields: [followUps.agentId],
    references: [users.id],
    relationName: "followUpAgent",
  }),
}));

export const notInterestedRecordsRelations = relations(notInterestedRecords, ({ one }) => ({
  call: one(calls, { fields: [notInterestedRecords.callId], references: [calls.id] }),
  createdBy: one(users, { fields: [notInterestedRecords.createdById], references: [users.id] }),
}));

export type Call = typeof calls.$inferSelect;
export type FollowUp = typeof followUps.$inferSelect;
export type NotInterestedRecord = typeof notInterestedRecords.$inferSelect;
