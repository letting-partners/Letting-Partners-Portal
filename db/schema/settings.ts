import { relations, sql } from "drizzle-orm";
import {
  check,
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
import { commissionScopeEnum, commissionTypeEnum } from "./enums";
import { users } from "./users";

/** Free-form typed settings (company details, chat routing, defaults). */
export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),
  updatedById: uuid("updated_by_id").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Global default commission rules. Superseded rows keep `effectiveTo` so a
 * historic sale can always be explained by the rule that was live at the time.
 */
export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: commissionScopeEnum("scope").notNull(),
    commissionType: commissionTypeEnum("commission_type").notNull(),
    /** Basis points when PERCENTAGE (1000 = 10.00%), pence when FIXED. */
    value: integer("value").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
  },
  (t) => [
    index("commission_rules_scope_idx").on(t.scope),
    uniqueIndex("commission_rules_active_unique")
      .on(t.scope)
      .where(sql`${t.effectiveTo} is null`),
  ],
);

/** Cross-sell division of the agent pool. Must always total 10000 bp. */
export const crossSellSplits = pgTable(
  "cross_sell_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyAgentBp: integer("property_agent_bp").notNull(),
    tenantAgentBp: integer("tenant_agent_bp").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Fixed discriminator; only exists so one split can be live at a time. */
    singleton: varchar("singleton", { length: 1 }).notNull().default("X"),
  },
  (t) => [
    uniqueIndex("cross_sell_splits_active_unique")
      .on(t.singleton)
      .where(sql`${t.effectiveTo} is null`),
    check(
      "cross_sell_splits_total_100",
      sql`${t.propertyAgentBp} + ${t.tenantAgentBp} = 10000`,
    ),
  ],
);

/**
 * GBP to PKR rate history. Rate is stored x100 (36900 = 369.00 PKR per GBP) so
 * it stays an exact integer. Sales snapshot the rate that was live at closing.
 */
export const exchangeRates = pgTable(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    baseCurrency: varchar("base_currency", { length: 3 }).notNull().default("GBP"),
    quoteCurrency: varchar("quote_currency", { length: 3 }).notNull().default("PKR"),
    rateX100: integer("rate_x100").notNull(),
    source: varchar("source", { length: 40 }).notNull().default("MANUAL"),
    updatedById: uuid("updated_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exchange_rates_created_at_idx").on(t.createdAt)],
);

export const commissionRulesRelations = relations(commissionRules, ({ one }) => ({
  createdBy: one(users, { fields: [commissionRules.createdById], references: [users.id] }),
}));

export type SystemSetting = typeof systemSettings.$inferSelect;
export type CommissionRule = typeof commissionRules.$inferSelect;
export type CrossSellSplit = typeof crossSellSplits.$inferSelect;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
