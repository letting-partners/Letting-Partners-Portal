import { relations, sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { contactSourceEnum, dealerTypeEnum, genderEnum } from "./enums";
import { users } from "./users";

/**
 * A landlord is identified by the last 10 digits of their phone number.
 * `normalizedPhone` is the system identity key: it is unique across every live
 * landlord, which is what makes duplicate creation impossible regardless of how
 * the caller typed the number.
 */
export const landlords = pgTable(
  "landlords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Whether this contact owns the property or is an outside agent letting it
     * on an owner's behalf. Same fields either way; it changes how they are
     * addressed and lets calls and reports tell the two apart.
     *
     * The interface calls this the client, which reads better for both a
     * landlord and an outside agent. Kept as dealerType here rather than
     * spending a migration on a name.
     */
    dealerType: dealerTypeEnum("dealer_type").notNull().default("LANDLORD"),

    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }),

    /** Exactly what the user typed, preserved for display. */
    originalPhone: varchar("original_phone", { length: 32 }).notNull(),
    /** Last 10 digits. The identity key. Never casually editable. */
    normalizedPhone: varchar("normalized_phone", { length: 16 }).notNull(),
    alternatePhone: varchar("alternate_phone", { length: 32 }),

    gender: genderEnum("gender").notNull().default("PREFER_NOT_TO_SAY"),
    source: contactSourceEnum("source").notNull().default("CALL"),

    originatingFronterId: uuid("originating_fronter_id").references(() => users.id),
    assignedAgentId: uuid("assigned_agent_id").references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("landlords_normalized_phone_unique")
      .on(t.normalizedPhone)
      .where(sql`${t.deletedAt} is null`),
    index("landlords_normalized_phone_idx").on(t.normalizedPhone),
    index("landlords_fronter_idx").on(t.originatingFronterId),
    index("landlords_agent_idx").on(t.assignedAgentId),
    index("landlords_created_at_idx").on(t.createdAt),
  ],
);

/** Append-only trail of ownership and identity changes on a landlord. */
export const landlordOwnershipHistory = pgTable(
  "landlord_ownership_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id, { onDelete: "cascade" }),
    fromFronterId: uuid("from_fronter_id").references(() => users.id),
    toFronterId: uuid("to_fronter_id").references(() => users.id),
    fromAgentId: uuid("from_agent_id").references(() => users.id),
    toAgentId: uuid("to_agent_id").references(() => users.id),
    fromNormalizedPhone: varchar("from_normalized_phone", { length: 16 }),
    toNormalizedPhone: varchar("to_normalized_phone", { length: 16 }),
    reason: text("reason"),
    changedBy: uuid("changed_by")
      .notNull()
      .references(() => users.id),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loh_landlord_idx").on(t.landlordId)],
);

export const landlordsRelations = relations(landlords, ({ one, many }) => ({
  originatingFronter: one(users, {
    fields: [landlords.originatingFronterId],
    references: [users.id],
    relationName: "landlordFronter",
  }),
  assignedAgent: one(users, {
    fields: [landlords.assignedAgentId],
    references: [users.id],
    relationName: "landlordAgent",
  }),
  creator: one(users, {
    fields: [landlords.createdBy],
    references: [users.id],
    relationName: "landlordCreator",
  }),
  ownershipHistory: many(landlordOwnershipHistory),
}));

export const landlordOwnershipHistoryRelations = relations(landlordOwnershipHistory, ({ one }) => ({
  landlord: one(landlords, {
    fields: [landlordOwnershipHistory.landlordId],
    references: [landlords.id],
  }),
}));

export type Landlord = typeof landlords.$inferSelect;
export type NewLandlord = typeof landlords.$inferInsert;
