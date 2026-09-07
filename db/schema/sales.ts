import { relations } from "drizzle-orm";
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
import { commissionBeneficiaryEnum, commissionTypeEnum } from "./enums";
import { deals } from "./deals";
import { landlords } from "./landlords";
import { properties, propertyRooms } from "./properties";
import { tenants } from "./tenants";
import { users } from "./users";

/**
 * Created only inside the closing transaction. Every monetary figure here is a
 * frozen snapshot: changing commission settings later must never alter a sale
 * that has already completed.
 */
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: varchar("reference", { length: 24 }).notNull(),

    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    roomId: uuid("room_id").references(() => propertyRooms.id),
    landlordId: uuid("landlord_id")
      .notNull()
      .references(() => landlords.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),

    propertyAgentId: uuid("property_agent_id")
      .notNull()
      .references(() => users.id),
    tenantAgentId: uuid("tenant_agent_id").references(() => users.id),
    originatingFronterId: uuid("originating_fronter_id").references(() => users.id),
    collaborationId: uuid("collaboration_id"),

    /* ---------------------------------------------- frozen money, in pence */
    grossCommissionPence: integer("gross_commission_pence").notNull(),
    fronterCommissionPence: integer("fronter_commission_pence").notNull().default(0),
    agentPoolPence: integer("agent_pool_pence").notNull().default(0),
    propertyAgentCommissionPence: integer("property_agent_commission_pence").notNull().default(0),
    tenantAgentCommissionPence: integer("tenant_agent_commission_pence").notNull().default(0),
    companyNetPence: integer("company_net_pence").notNull().default(0),

    /** GBP -> PKR rate at closing time, stored x100 (36900 = 369.00). */
    pkrRateAtClose: integer("pkr_rate_at_close"),

    /** Complete, human-auditable input and output of the commission engine. */
    calculationSnapshot: jsonb("calculation_snapshot").notNull(),

    closingDate: timestamp("closing_date", { withTimezone: true }).notNull().defaultNow(),
    status: varchar("status", { length: 20 }).notNull().default("COMPLETED"),
    notes: text("notes"),

    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sales_reference_unique").on(t.reference),
    uniqueIndex("sales_deal_unique").on(t.dealId),
    index("sales_property_idx").on(t.propertyId),
    index("sales_property_agent_idx").on(t.propertyAgentId),
    index("sales_tenant_agent_idx").on(t.tenantAgentId),
    index("sales_fronter_idx").on(t.originatingFronterId),
    index("sales_closing_date_idx").on(t.closingDate),
  ],
);

/**
 * One row per beneficiary of a sale. `beneficiaryUserId` is null for the
 * company retained portion. The rule that produced the amount is copied in so
 * the figure can be re-derived years later.
 */
export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    beneficiary: commissionBeneficiaryEnum("beneficiary").notNull(),
    beneficiaryUserId: uuid("beneficiary_user_id").references(() => users.id),

    amountPence: integer("amount_pence").notNull(),
    /** The amount this share was calculated from. */
    basisPence: integer("basis_pence").notNull(),
    ruleType: commissionTypeEnum("rule_type"),
    /** Basis points when PERCENTAGE, pence when FIXED. */
    ruleValue: integer("rule_value"),

    pkrRateAtClose: integer("pkr_rate_at_close"),
    pkrAmount: integer("pkr_amount"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("commissions_sale_idx").on(t.saleId),
    index("commissions_user_idx").on(t.beneficiaryUserId),
    index("commissions_beneficiary_idx").on(t.beneficiary),
  ],
);

export const salesRelations = relations(sales, ({ one, many }) => ({
  deal: one(deals, { fields: [sales.dealId], references: [deals.id] }),
  property: one(properties, { fields: [sales.propertyId], references: [properties.id] }),
  room: one(propertyRooms, { fields: [sales.roomId], references: [propertyRooms.id] }),
  landlord: one(landlords, { fields: [sales.landlordId], references: [landlords.id] }),
  tenant: one(tenants, { fields: [sales.tenantId], references: [tenants.id] }),
  propertyAgent: one(users, {
    fields: [sales.propertyAgentId],
    references: [users.id],
    relationName: "salePropertyAgent",
  }),
  tenantAgent: one(users, {
    fields: [sales.tenantAgentId],
    references: [users.id],
    relationName: "saleTenantAgent",
  }),
  fronter: one(users, {
    fields: [sales.originatingFronterId],
    references: [users.id],
    relationName: "saleFronter",
  }),
  commissions: many(commissions),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  sale: one(sales, { fields: [commissions.saleId], references: [sales.id] }),
  beneficiaryUser: one(users, {
    fields: [commissions.beneficiaryUserId],
    references: [users.id],
  }),
}));

export type Sale = typeof sales.$inferSelect;
export type Commission = typeof commissions.$inferSelect;
