import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { contactSourceEnum, propertyCategoryEnum, tenantStatusEnum } from "./enums";
import { users } from "./users";

/**
 * Applicants looking for a property. Owned by an agent - `ownerAgentId` is the
 * explicit ownership key used by both the permission service and the
 * cross-sell flow (the tenant agent in a collaboration is this agent).
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 254 }),
    originalPhone: varchar("original_phone", { length: 32 }).notNull(),
    normalizedPhone: varchar("normalized_phone", { length: 16 }).notNull(),

    area: varchar("area", { length: 160 }),
    /** Comma separated outcodes the applicant will consider, e.g. "M14,M13". */
    postcodePreferences: varchar("postcode_preferences", { length: 200 }),
    requirements: text("requirements"),

    minBudgetPence: integer("min_budget_pence"),
    maxBudgetPence: integer("max_budget_pence"),
    moveInDate: date("move_in_date"),
    propertyTypePreference: propertyCategoryEnum("property_type_preference"),
    bedrooms: integer("bedrooms"),

    status: tenantStatusEnum("status").notNull().default("ACTIVE"),
    source: contactSourceEnum("source").notNull().default("MANUAL"),

    ownerAgentId: uuid("owner_agent_id")
      .notNull()
      .references(() => users.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by").references(() => users.id),
  },
  (t) => [
    index("tenants_owner_agent_idx").on(t.ownerAgentId),
    index("tenants_normalized_phone_idx").on(t.normalizedPhone),
    index("tenants_status_idx").on(t.status),
    index("tenants_created_at_idx").on(t.createdAt),
  ],
);

export const tenantsRelations = relations(tenants, ({ one }) => ({
  ownerAgent: one(users, {
    fields: [tenants.ownerAgentId],
    references: [users.id],
    relationName: "tenantOwnerAgent",
  }),
  creator: one(users, {
    fields: [tenants.createdBy],
    references: [users.id],
    relationName: "tenantCreator",
  }),
}));

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
