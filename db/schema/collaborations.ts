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
import { collaborationStatusEnum } from "./enums";
import { deals } from "./deals";
import { properties, propertyRooms } from "./properties";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * A cross-sell: one agent has the tenant, another has the property. The split
 * percentages are copied onto the row when the request is accepted so that a
 * later settings change cannot retroactively alter an agreed collaboration.
 */
export const collaborations = pgTable(
  "collaborations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomId: uuid("room_id").references(() => propertyRooms.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),

    tenantAgentId: uuid("tenant_agent_id")
      .notNull()
      .references(() => users.id),
    propertyAgentId: uuid("property_agent_id")
      .notNull()
      .references(() => users.id),

    status: collaborationStatusEnum("status").notNull().default("PENDING"),
    message: text("message"),
    declineReason: text("decline_reason"),

    /** Split of the agent pool, in basis points, frozen at acceptance. */
    propertyAgentSplitBp: integer("property_agent_split_bp"),
    tenantAgentSplitBp: integer("tenant_agent_split_bp"),

    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "set null" }),

    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("collaborations_property_idx").on(t.propertyId),
    index("collaborations_tenant_agent_idx").on(t.tenantAgentId),
    index("collaborations_property_agent_idx").on(t.propertyAgentId),
    index("collaborations_status_idx").on(t.status),
    /** Do not let the same tenant/property pair be requested twice while live. */
    uniqueIndex("collaborations_open_request_unique")
      .on(t.propertyId, t.tenantId)
      .where(sql`${t.status} in ('PENDING','ACCEPTED','VIEWING','VERIFICATION','CLOSING')`),
  ],
);

export const collaborationParticipants = pgTable(
  "collaboration_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collaborationId: uuid("collaboration_id")
      .notNull()
      .references(() => collaborations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 32 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("collaboration_participants_unique").on(t.collaborationId, t.userId)],
);

export const collaborationsRelations = relations(collaborations, ({ one, many }) => ({
  property: one(properties, { fields: [collaborations.propertyId], references: [properties.id] }),
  room: one(propertyRooms, { fields: [collaborations.roomId], references: [propertyRooms.id] }),
  tenant: one(tenants, { fields: [collaborations.tenantId], references: [tenants.id] }),
  tenantAgent: one(users, {
    fields: [collaborations.tenantAgentId],
    references: [users.id],
    relationName: "collabTenantAgent",
  }),
  propertyAgent: one(users, {
    fields: [collaborations.propertyAgentId],
    references: [users.id],
    relationName: "collabPropertyAgent",
  }),
  deal: one(deals, { fields: [collaborations.dealId], references: [deals.id] }),
  participants: many(collaborationParticipants),
}));

export const collaborationParticipantsRelations = relations(
  collaborationParticipants,
  ({ one }) => ({
    collaboration: one(collaborations, {
      fields: [collaborationParticipants.collaborationId],
      references: [collaborations.id],
    }),
    user: one(users, { fields: [collaborationParticipants.userId], references: [users.id] }),
  }),
);

export type Collaboration = typeof collaborations.$inferSelect;
