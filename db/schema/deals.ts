import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  closingStatusEnum,
  dealStageEnum,
  verificationStatusEnum,
  viewingStatusEnum,
} from "./enums";
import { landlords } from "./landlords";
import { properties, propertyRooms } from "./properties";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * A deal is one attempt to place one tenant into one property (or one room of a
 * shared property). It carries the pipeline stage; the property keeps its own
 * separate website listing status.
 *
 * The two partial unique indexes below are what make a duplicate successful
 * closing impossible at the database level.
 */
export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    /** Null for a full property, set for a room of a shared property. */
    roomId: uuid("room_id").references(() => propertyRooms.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id),

    stage: dealStageEnum("stage").notNull().default("VIEWING"),

    /** Agent who manages the property side of the deal. */
    propertyAgentId: uuid("property_agent_id")
      .notNull()
      .references(() => users.id),
    /** Set only on a cross-sell: the agent who brought the tenant. */
    tenantAgentId: uuid("tenant_agent_id").references(() => users.id),
    originatingFronterId: uuid("originating_fronter_id").references(() => users.id),
    collaborationId: uuid("collaboration_id"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closeReason: text("close_reason"),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("deals_property_idx").on(t.propertyId),
    index("deals_room_idx").on(t.roomId),
    index("deals_tenant_idx").on(t.tenantId),
    index("deals_stage_idx").on(t.stage),
    index("deals_property_agent_idx").on(t.propertyAgentId),
    index("deals_tenant_agent_idx").on(t.tenantAgentId),
    index("deals_fronter_idx").on(t.originatingFronterId),
    uniqueIndex("deals_one_success_per_room")
      .on(t.roomId)
      .where(sql`${t.roomId} is not null and ${t.stage} = 'CLOSED_SUCCESSFUL'`),
    uniqueIndex("deals_one_success_per_property")
      .on(t.propertyId)
      .where(sql`${t.roomId} is null and ${t.stage} = 'CLOSED_SUCCESSFUL'`),
    /** Only one deal may occupy the live pipeline for a given room/property. */
    uniqueIndex("deals_one_active_per_room")
      .on(t.roomId)
      .where(
        sql`${t.roomId} is not null and ${t.stage} in ('VIEWING','VERIFICATION','CLOSING')`,
      ),
    uniqueIndex("deals_one_active_per_property")
      .on(t.propertyId)
      .where(
        sql`${t.roomId} is null and ${t.stage} in ('VIEWING','VERIFICATION','CLOSING')`,
      ),
  ],
);

/** Append-only. Every stage transition, including failures and reopens. */
export const dealStageHistory = pgTable(
  "deal_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    fromStage: dealStageEnum("from_stage"),
    toStage: dealStageEnum("to_stage").notNull(),
    reason: text("reason"),
    notes: text("notes"),
    changedById: uuid("changed_by_id")
      .notNull()
      .references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("dsh_deal_idx").on(t.dealId), index("dsh_changed_at_idx").on(t.changedAt)],
);

export const viewings = pgTable(
  "viewings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => propertyRooms.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => users.id),

    attemptNumber: integer("attempt_number").notNull().default(1),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    status: viewingStatusEnum("status").notNull().default("SCHEDULED"),
    outcomeReason: text("outcome_reason"),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("viewings_deal_idx").on(t.dealId),
    index("viewings_property_idx").on(t.propertyId),
    index("viewings_tenant_idx").on(t.tenantId),
    index("viewings_agent_idx").on(t.agentId),
    index("viewings_status_idx").on(t.status),
    index("viewings_scheduled_idx").on(t.scheduledFor),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: verificationStatusEnum("status").notNull().default("IN_PROGRESS"),
    reason: text("reason"),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    startedById: uuid("started_by_id")
      .notNull()
      .references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id),
  },
  (t) => [index("verifications_deal_idx").on(t.dealId), index("verifications_status_idx").on(t.status)],
);

export const closings = pgTable(
  "closings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: closingStatusEnum("status").notNull().default("IN_PROGRESS"),
    reason: text("reason"),
    notes: text("notes"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    startedById: uuid("started_by_id")
      .notNull()
      .references(() => users.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedById: uuid("completed_by_id").references(() => users.id),
  },
  (t) => [index("closings_deal_idx").on(t.dealId), index("closings_status_idx").on(t.status)],
);

export const dealsRelations = relations(deals, ({ one, many }) => ({
  property: one(properties, { fields: [deals.propertyId], references: [properties.id] }),
  room: one(propertyRooms, { fields: [deals.roomId], references: [propertyRooms.id] }),
  tenant: one(tenants, { fields: [deals.tenantId], references: [tenants.id] }),
  landlord: one(landlords, { fields: [deals.landlordId], references: [landlords.id] }),
  propertyAgent: one(users, {
    fields: [deals.propertyAgentId],
    references: [users.id],
    relationName: "dealPropertyAgent",
  }),
  tenantAgent: one(users, {
    fields: [deals.tenantAgentId],
    references: [users.id],
    relationName: "dealTenantAgent",
  }),
  stageHistory: many(dealStageHistory),
  viewings: many(viewings),
  verifications: many(verifications),
  closings: many(closings),
}));

export const dealStageHistoryRelations = relations(dealStageHistory, ({ one }) => ({
  deal: one(deals, { fields: [dealStageHistory.dealId], references: [deals.id] }),
  changedBy: one(users, { fields: [dealStageHistory.changedById], references: [users.id] }),
}));

export const viewingsRelations = relations(viewings, ({ one }) => ({
  deal: one(deals, { fields: [viewings.dealId], references: [deals.id] }),
  property: one(properties, { fields: [viewings.propertyId], references: [properties.id] }),
  tenant: one(tenants, { fields: [viewings.tenantId], references: [tenants.id] }),
  agent: one(users, { fields: [viewings.agentId], references: [users.id] }),
}));

export const verificationsRelations = relations(verifications, ({ one }) => ({
  deal: one(deals, { fields: [verifications.dealId], references: [deals.id] }),
}));

export const closingsRelations = relations(closings, ({ one }) => ({
  deal: one(deals, { fields: [closings.dealId], references: [deals.id] }),
}));

export type Deal = typeof deals.$inferSelect;
export type DealStageHistoryRow = typeof dealStageHistory.$inferSelect;
export type Viewing = typeof viewings.$inferSelect;
export type Verification = typeof verifications.$inferSelect;
export type Closing = typeof closings.$inferSelect;
