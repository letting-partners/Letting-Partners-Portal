import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { activityTypeEnum, auditActionEnum } from "./enums";
import { users } from "./users";

/**
 * Compliance trail. Append-only: nothing in the application ever updates or
 * deletes a row here.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    /** Kept as text so the trail survives a user record being removed. */
    userLabel: varchar("user_label", { length: 200 }),
    action: auditActionEnum("action").notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id"),
    entityLabel: varchar("entity_label", { length: 200 }),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    ip: varchar("ip", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_user_idx").on(t.userId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_action_idx").on(t.action),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

/**
 * Human-readable timeline entries rendered on record detail pages. A softer,
 * display-oriented sibling of the audit log.
 */
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: activityTypeEnum("type").notNull(),
    entityType: varchar("entity_type", { length: 60 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    /** Optional second subject, e.g. the property behind a landlord activity. */
    relatedEntityType: varchar("related_entity_type", { length: 60 }),
    relatedEntityId: uuid("related_entity_id"),
    actorId: uuid("actor_id").references(() => users.id),
    summary: varchar("summary", { length: 300 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activities_entity_idx").on(t.entityType, t.entityId),
    index("activities_actor_idx").on(t.actorId),
    index("activities_created_at_idx").on(t.createdAt),
  ],
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
}));

export type AuditLogRow = typeof auditLog.$inferSelect;
export type Activity = typeof activities.$inferSelect;
