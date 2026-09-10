import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  conversationStatusEnum,
  internalConversationTypeEnum,
  messageSenderEnum,
  noteEntityEnum,
  notificationTypeEnum,
} from "./enums";
import { properties } from "./properties";
import { users } from "./users";

/* ------------------------------------------------------------------ notes */

/**
 * Polymorphic internal note. `entityType` + `entityId` point at whatever the
 * note is about; edits keep the original text in `editHistory`.
 */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: noteEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    body: text("body").notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id),
    editHistory: jsonb("edit_history"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("notes_entity_idx").on(t.entityType, t.entityId),
    index("notes_author_idx").on(t.authorId),
    index("notes_created_at_idx").on(t.createdAt),
  ],
);

/**
 * A private scratchpad, one per user.
 *
 * Deliberately not the notes table: those hang off a landlord or a property
 * and an admin can read and edit any of them, which is right for a shared
 * record and wrong for something called personal. Every query here filters by
 * the owner, with no admin override.
 */
export const personalNotes = pgTable(
  "personal_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }),
    body: text("body").notNull().default(""),
    /** Pinned notes sort to the top of the owner's list. */
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("personal_notes_user_idx").on(t.userId, t.updatedAt),
  ],
);

/* ---------------------------------------------------------- notifications */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    /** In-app link to the record the notification is about. */
    href: varchar("href", { length: 300 }),
    entityType: varchar("entity_type", { length: 40 }),
    entityId: uuid("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_user_idx").on(t.userId),
    index("notifications_created_at_idx").on(t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.readAt),
  ],
);

/* ------------------------------------------------------- customer (public) */

/**
 * Website visitor conversations. Deliberately a separate table tree from the
 * internal staff chat so a customer can never land in an internal thread.
 */
export const customerConversations = pgTable(
  "customer_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Opaque id held by the visitor browser; lets them resume their thread. */
    visitorToken: varchar("visitor_token", { length: 64 }).notNull(),
    visitorName: varchar("visitor_name", { length: 160 }),
    visitorEmail: varchar("visitor_email", { length: 254 }),
    visitorPhone: varchar("visitor_phone", { length: 32 }),

    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    /** Agent the enquiry was routed to (the publishing agent by default). */
    assignedAgentId: uuid("assigned_agent_id").references(() => users.id),

    status: conversationStatusEnum("status").notNull().default("NEW"),
    subject: varchar("subject", { length: 200 }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    lastVisitorSeenAt: timestamp("last_visitor_seen_at", { withTimezone: true }),
    lastStaffSeenAt: timestamp("last_staff_seen_at", { withTimezone: true }),
    visitorTypingAt: timestamp("visitor_typing_at", { withTimezone: true }),
    staffTypingAt: timestamp("staff_typing_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("customer_conversations_token_unique").on(t.visitorToken),
    index("customer_conversations_property_idx").on(t.propertyId),
    index("customer_conversations_agent_idx").on(t.assignedAgentId),
    index("customer_conversations_status_idx").on(t.status),
    index("customer_conversations_last_message_idx").on(t.lastMessageAt),
  ],
);

export const customerMessages = pgTable(
  "customer_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => customerConversations.id, { onDelete: "cascade" }),
    sender: messageSenderEnum("sender").notNull(),
    /** Set when a staff member sent the message. */
    senderUserId: uuid("sender_user_id").references(() => users.id),
    body: text("body").notNull(),
    /** Internal notes are visible to staff only and never sent to the visitor. */
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    attachmentUrl: text("attachment_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customer_messages_conversation_idx").on(t.conversationId, t.createdAt),
  ],
);

/** Audit of who took, transferred or resolved a customer conversation. */
export const customerConversationEvents = pgTable(
  "customer_conversation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => customerConversations.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 32 }).notNull(),
    fromUserId: uuid("from_user_id").references(() => users.id),
    toUserId: uuid("to_user_id").references(() => users.id),
    performedById: uuid("performed_by_id").references(() => users.id),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cce_conversation_idx").on(t.conversationId)],
);

/* -------------------------------------------------------- internal (staff) */

export const internalConversations = pgTable(
  "internal_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: internalConversationTypeEnum("type").notNull().default("DIRECT"),
    title: varchar("title", { length: 160 }),
    /** Sorted, joined participant ids - makes a direct thread idempotent. */
    directKey: varchar("direct_key", { length: 200 }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("internal_conversations_direct_key_unique").on(t.directKey),
    index("internal_conversations_last_message_idx").on(t.lastMessageAt),
  ],
);

export const internalConversationParticipants = pgTable(
  "internal_conversation_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => internalConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    typingAt: timestamp("typing_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("icp_unique").on(t.conversationId, t.userId),
    index("icp_user_idx").on(t.userId),
  ],
);

export const internalMessages = pgTable(
  "internal_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => internalConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    replyToId: uuid("reply_to_id"),
    attachmentUrl: text("attachment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("internal_messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/** Coarse presence, refreshed by the client heartbeat. */
export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, { fields: [notes.authorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const customerConversationsRelations = relations(
  customerConversations,
  ({ one, many }) => ({
    property: one(properties, {
      fields: [customerConversations.propertyId],
      references: [properties.id],
    }),
    assignedAgent: one(users, {
      fields: [customerConversations.assignedAgentId],
      references: [users.id],
    }),
    messages: many(customerMessages),
  }),
);

export const customerMessagesRelations = relations(customerMessages, ({ one }) => ({
  conversation: one(customerConversations, {
    fields: [customerMessages.conversationId],
    references: [customerConversations.id],
  }),
  senderUser: one(users, { fields: [customerMessages.senderUserId], references: [users.id] }),
}));

export const internalConversationsRelations = relations(
  internalConversations,
  ({ many }) => ({
    participants: many(internalConversationParticipants),
    messages: many(internalMessages),
  }),
);

export const internalConversationParticipantsRelations = relations(
  internalConversationParticipants,
  ({ one }) => ({
    conversation: one(internalConversations, {
      fields: [internalConversationParticipants.conversationId],
      references: [internalConversations.id],
    }),
    user: one(users, {
      fields: [internalConversationParticipants.userId],
      references: [users.id],
    }),
  }),
);

export const internalMessagesRelations = relations(internalMessages, ({ one }) => ({
  conversation: one(internalConversations, {
    fields: [internalMessages.conversationId],
    references: [internalConversations.id],
  }),
  sender: one(users, { fields: [internalMessages.senderId], references: [users.id] }),
}));

export type Note = typeof notes.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type CustomerConversation = typeof customerConversations.$inferSelect;
export type CustomerMessage = typeof customerMessages.$inferSelect;
export type InternalConversation = typeof internalConversations.$inferSelect;
export type InternalMessage = typeof internalMessages.$inferSelect;
