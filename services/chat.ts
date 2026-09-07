import "server-only";
import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql as raw, type SQL } from "drizzle-orm";
import { db, type Transaction } from "@/db";
import {
  customerConversationEvents,
  customerConversations,
  customerMessages,
  internalConversationParticipants,
  internalConversations,
  internalMessages,
  properties,
  userPresence,
  users,
} from "@/db/schema";
import { generateVisitorToken } from "@/lib/auth/crypto";
import { normalizeUKPhone } from "@/lib/phone";
import { ENTITY, recordAudit } from "./audit";
import { loadPeopleMap } from "./landlords";
import { notifyMany } from "./notifications";
import {
  canAccessCustomerChat,
  ForbiddenError,
  type AccessContext,
} from "./permissions";

/**
 * Two completely separate conversation systems.
 *
 *   customer*  website visitors talking to an agent or manager
 *   internal*  staff talking to each other
 *
 * They share no tables and no functions, so a customer can never be routed
 * into an internal thread and an internal message can never reach a visitor.
 * Customer chat is also closed to fronters by policy.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ChatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatError";
  }
}

/* ======================================================================
 * Customer chat (public)
 * ==================================================================== */

/**
 * Start or resume a visitor conversation.
 *
 * Routing: a property enquiry goes to the agent who publishes that property.
 * If there is no agent, it is left unassigned for any manager to pick up.
 */
export async function startCustomerConversation(input: {
  visitorToken?: string | null;
  /** The public slug or the internal property id. */
  propertyId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message: string;
}): Promise<{ conversationId: string; visitorToken: string }> {
  if (!input.message.trim()) throw new ChatError("Write a message before sending.");

  return db.transaction(async (tx) => {
    // Resume the visitor's existing thread when they still hold the token.
    if (input.visitorToken) {
      const existing = await tx
        .select()
        .from(customerConversations)
        .where(eq(customerConversations.visitorToken, input.visitorToken))
        .limit(1);

      if (existing[0]) {
        await appendCustomerMessage(tx, {
          conversationId: existing[0].id,
          sender: "VISITOR",
          body: input.message,
        });
        return { conversationId: existing[0].id, visitorToken: input.visitorToken };
      }
    }

    let assignedAgentId: string | null = null;
    let subject: string | null = null;
    let propertyId: string | null = null;

    if (input.propertyId) {
      // The website identifies a property by its public slug, so accept either
      // that or the internal id rather than making the slug leak a uuid.
      const isUuid = UUID_PATTERN.test(input.propertyId);

      const rows = await tx
        .select({
          id: properties.id,
          assignedAgentId: properties.assignedAgentId,
          publishedById: properties.publishedById,
          title: properties.title,
          reference: properties.reference,
        })
        .from(properties)
        .where(
          and(
            isUuid ? eq(properties.id, input.propertyId) : eq(properties.slug, input.propertyId),
            isNull(properties.deletedAt),
          ),
        )
        .limit(1);

      const property = rows[0];
      if (property) {
        propertyId = property.id;
        assignedAgentId = property.assignedAgentId ?? property.publishedById;
        subject = property.title ?? property.reference;
      }
    }

    const visitorToken = input.visitorToken || generateVisitorToken();

    const inserted = await tx
      .insert(customerConversations)
      .values({
        visitorToken,
        visitorName: input.name?.trim() || null,
        visitorEmail: input.email?.trim() || null,
        visitorPhone: input.phone ? (normalizeUKPhone(input.phone) ?? input.phone) : null,
        propertyId,
        assignedAgentId,
        status: "NEW",
        subject,
      })
      .returning({ id: customerConversations.id });

    const conversation = inserted[0];

    await appendCustomerMessage(tx, {
      conversationId: conversation.id,
      sender: "VISITOR",
      body: input.message,
    });

    // Unassigned enquiries need to reach somebody, so every admin is told.
    const recipients = assignedAgentId
      ? [assignedAgentId]
      : (
          await tx
            .select({ id: users.id })
            .from(users)
            .where(and(eq(users.role, "SUPER_ADMIN"), isNull(users.deletedAt)))
        ).map((row) => row.id);

    await notifyMany(
      recipients,
      {
        type: "NEW_CUSTOMER_CHAT",
        title: "New website enquiry",
        body: subject ? `About ${subject}` : "A visitor started a chat.",
        href: `/chats/customer?conversation=${conversation.id}`,
        entityType: ENTITY.conversation,
        entityId: conversation.id,
      },
      tx,
    );

    return { conversationId: conversation.id, visitorToken };
  });
}

async function appendCustomerMessage(
  tx: Transaction,
  input: {
    conversationId: string;
    sender: "VISITOR" | "STAFF" | "SYSTEM";
    senderUserId?: string | null;
    body: string;
    isInternalNote?: boolean;
  },
) {
  const inserted = await tx
    .insert(customerMessages)
    .values({
      conversationId: input.conversationId,
      sender: input.sender,
      senderUserId: input.senderUserId ?? null,
      body: input.body.trim(),
      isInternalNote: input.isInternalNote ?? false,
    })
    .returning({ id: customerMessages.id });

  // An internal note is not a reply, so it must not reopen the conversation.
  if (!input.isInternalNote) {
    await tx
      .update(customerConversations)
      .set({
        lastMessageAt: new Date(),
        status: input.sender === "VISITOR" ? "OPEN" : "WAITING",
      })
      .where(eq(customerConversations.id, input.conversationId));
  }

  return inserted[0];
}

/** A visitor sending a follow-up message on their own thread. */
export async function addVisitorMessage(
  visitorToken: string,
  body: string,
): Promise<{ conversationId: string }> {
  if (!body.trim()) throw new ChatError("Write a message before sending.");

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(customerConversations)
      .where(eq(customerConversations.visitorToken, visitorToken))
      .limit(1);

    const conversation = rows[0];
    if (!conversation) throw new ChatError("That conversation could not be found.");
    if (conversation.archivedAt) throw new ChatError("That conversation has been closed.");

    await appendCustomerMessage(tx, {
      conversationId: conversation.id,
      sender: "VISITOR",
      body,
    });

    await notifyMany(
      [conversation.assignedAgentId],
      {
        type: "CUSTOMER_CHAT_MESSAGE",
        title: "New message from a website visitor",
        body: body.slice(0, 120),
        href: `/chats/customer?conversation=${conversation.id}`,
        entityType: ENTITY.conversation,
        entityId: conversation.id,
      },
      tx,
    );

    return { conversationId: conversation.id };
  });
}

/** The visitor's own view of their thread. Internal notes are excluded. */
export async function getVisitorThread(visitorToken: string) {
  const rows = await db
    .select()
    .from(customerConversations)
    .where(eq(customerConversations.visitorToken, visitorToken))
    .limit(1);

  const conversation = rows[0];
  if (!conversation) return null;

  const messages = await db
    .select({
      id: customerMessages.id,
      sender: customerMessages.sender,
      body: customerMessages.body,
      createdAt: customerMessages.createdAt,
      senderName: users.fullName,
    })
    .from(customerMessages)
    .leftJoin(users, eq(users.id, customerMessages.senderUserId))
    .where(
      and(
        eq(customerMessages.conversationId, conversation.id),
        eq(customerMessages.isInternalNote, false),
      ),
    )
    .orderBy(asc(customerMessages.createdAt));

  return {
    conversationId: conversation.id,
    status: conversation.status,
    messages: messages.map((message) => ({
      id: message.id,
      sender: message.sender,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      senderName: message.sender === "STAFF" ? (message.senderName ?? "Letting Partners") : null,
    })),
  };
}

/* --------------------------------------------------------- staff inbox */

export type CustomerInboxFilters = {
  status?: string;
  assigned?: "me" | "unassigned" | "all";
  page?: number;
  pageSize?: number;
};

export async function listCustomerConversations(
  context: AccessContext,
  filters: CustomerInboxFilters = {},
) {
  if (!canAccessCustomerChat(context)) throw new ForbiddenError();

  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 30, 1), 100);

  const conditions: (SQL | undefined)[] = [isNull(customerConversations.archivedAt)];

  if (filters.status) {
    conditions.push(
      eq(
        customerConversations.status,
        filters.status as typeof customerConversations.$inferSelect.status,
      ),
    );
  }

  if (filters.assigned === "me") {
    conditions.push(eq(customerConversations.assignedAgentId, context.user.id));
  } else if (filters.assigned === "unassigned") {
    conditions.push(isNull(customerConversations.assignedAgentId));
  } else if (!context.isAdmin) {
    // An agent sees their own conversations plus anything waiting to be taken.
    conditions.push(
      or(
        eq(customerConversations.assignedAgentId, context.user.id),
        isNull(customerConversations.assignedAgentId),
      ),
    );
  }

  const where = and(...conditions);

  const [rows, totalRows] = await Promise.all([
    db
      .select({
        id: customerConversations.id,
        visitorName: customerConversations.visitorName,
        visitorEmail: customerConversations.visitorEmail,
        visitorPhone: customerConversations.visitorPhone,
        subject: customerConversations.subject,
        status: customerConversations.status,
        lastMessageAt: customerConversations.lastMessageAt,
        lastStaffSeenAt: customerConversations.lastStaffSeenAt,
        createdAt: customerConversations.createdAt,
        propertyId: customerConversations.propertyId,
        propertyReference: properties.reference,
        assignedAgentId: customerConversations.assignedAgentId,
        lastMessage: raw<string | null>`(
          select m.body from ${customerMessages} m
          where m.conversation_id = ${customerConversations.id} and m.is_internal_note = false
          order by m.created_at desc limit 1
        )`,
        unread: raw<number>`(
          select count(*)::int from ${customerMessages} m
          where m.conversation_id = ${customerConversations.id}
            and m.sender = 'VISITOR'
            and (
              ${customerConversations.lastStaffSeenAt} is null
              or m.created_at > ${customerConversations.lastStaffSeenAt}
            )
        )`,
      })
      .from(customerConversations)
      .leftJoin(properties, eq(properties.id, customerConversations.propertyId))
      .where(where)
      .orderBy(desc(customerConversations.lastMessageAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),

    db
      .select({ value: count() })
      .from(customerConversations)
      .leftJoin(properties, eq(properties.id, customerConversations.propertyId))
      .where(where),
  ]);

  const people = await loadPeopleMap(rows.map((row) => row.assignedAgentId));

  return {
    rows: rows.map((row) => ({
      ...row,
      unread: Number(row.unread),
      assignedAgent: row.assignedAgentId ? (people.get(row.assignedAgentId) ?? null) : null,
      isMine: row.assignedAgentId === context.user.id,
    })),
    total: Number(totalRows[0]?.value ?? 0),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(Number(totalRows[0]?.value ?? 0) / pageSize)),
  };
}

export async function getCustomerConversation(id: string, context: AccessContext) {
  if (!canAccessCustomerChat(context)) throw new ForbiddenError();

  const rows = await db
    .select({
      conversation: customerConversations,
      propertyReference: properties.reference,
      propertyTitle: properties.title,
    })
    .from(customerConversations)
    .leftJoin(properties, eq(properties.id, customerConversations.propertyId))
    .where(eq(customerConversations.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // An agent may open their own conversations, or an unassigned one to take it.
  if (
    !context.isAdmin &&
    row.conversation.assignedAgentId &&
    row.conversation.assignedAgentId !== context.user.id
  ) {
    throw new ForbiddenError();
  }

  const [messages, events, people] = await Promise.all([
    db
      .select({
        id: customerMessages.id,
        sender: customerMessages.sender,
        senderUserId: customerMessages.senderUserId,
        senderName: users.fullName,
        senderAvatar: users.avatarUrl,
        body: customerMessages.body,
        isInternalNote: customerMessages.isInternalNote,
        createdAt: customerMessages.createdAt,
      })
      .from(customerMessages)
      .leftJoin(users, eq(users.id, customerMessages.senderUserId))
      .where(eq(customerMessages.conversationId, id))
      .orderBy(asc(customerMessages.createdAt)),

    db
      .select()
      .from(customerConversationEvents)
      .where(eq(customerConversationEvents.conversationId, id))
      .orderBy(desc(customerConversationEvents.createdAt))
      .limit(20),

    loadPeopleMap([row.conversation.assignedAgentId]),
  ]);

  // Opening the thread marks it seen, which is what clears the unread badge.
  await db
    .update(customerConversations)
    .set({ lastStaffSeenAt: new Date() })
    .where(eq(customerConversations.id, id));

  return {
    conversation: row.conversation,
    propertyReference: row.propertyReference,
    propertyTitle: row.propertyTitle,
    messages,
    events,
    assignedAgent: row.conversation.assignedAgentId
      ? (people.get(row.conversation.assignedAgentId) ?? null)
      : null,
  };
}

export async function replyToCustomer(
  conversationId: string,
  body: string,
  context: AccessContext,
  options: { internalNote?: boolean } = {},
): Promise<void> {
  if (!canAccessCustomerChat(context)) throw new ForbiddenError();
  if (!body.trim()) throw new ChatError("Write a message before sending.");

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(customerConversations)
      .where(eq(customerConversations.id, conversationId))
      .limit(1);

    const conversation = rows[0];
    if (!conversation) throw new ChatError("That conversation no longer exists.");

    if (
      !context.isAdmin &&
      conversation.assignedAgentId &&
      conversation.assignedAgentId !== context.user.id
    ) {
      throw new ForbiddenError();
    }

    // Replying to an unassigned conversation takes ownership of it.
    if (!conversation.assignedAgentId) {
      await tx
        .update(customerConversations)
        .set({ assignedAgentId: context.user.id })
        .where(eq(customerConversations.id, conversationId));

      await tx.insert(customerConversationEvents).values({
        conversationId,
        action: "TAKEN",
        toUserId: context.user.id,
        performedById: context.user.id,
      });
    }

    await appendCustomerMessage(tx, {
      conversationId,
      sender: "STAFF",
      senderUserId: context.user.id,
      body,
      isInternalNote: options.internalNote,
    });
  });
}

export async function assignCustomerConversation(
  conversationId: string,
  toUserId: string,
  context: AccessContext,
): Promise<void> {
  if (!canAccessCustomerChat(context)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(customerConversations)
      .where(eq(customerConversations.id, conversationId))
      .limit(1);

    const conversation = rows[0];
    if (!conversation) throw new ChatError("That conversation no longer exists.");

    // Only an admin can move a conversation away from another agent.
    if (
      !context.isAdmin &&
      conversation.assignedAgentId &&
      conversation.assignedAgentId !== context.user.id
    ) {
      throw new ForbiddenError();
    }

    await tx
      .update(customerConversations)
      .set({ assignedAgentId: toUserId })
      .where(eq(customerConversations.id, conversationId));

    await tx.insert(customerConversationEvents).values({
      conversationId,
      action: conversation.assignedAgentId ? "TRANSFERRED" : "ASSIGNED",
      fromUserId: conversation.assignedAgentId,
      toUserId,
      performedById: context.user.id,
    });

    await notifyMany(
      [toUserId],
      {
        type: "NEW_CUSTOMER_CHAT",
        title: "A customer chat was assigned to you",
        body: conversation.subject ?? "A website enquiry needs a reply.",
        href: `/chats/customer?conversation=${conversationId}`,
        entityType: ENTITY.conversation,
        entityId: conversationId,
      },
      tx,
    );

    await recordAudit(
      {
        user: context.user,
        action: "ASSIGN",
        entityType: ENTITY.conversation,
        entityId: conversationId,
        before: { assignedAgentId: conversation.assignedAgentId },
        after: { assignedAgentId: toUserId },
      },
      tx,
    );
  });
}

export async function setCustomerConversationStatus(
  conversationId: string,
  status: "OPEN" | "WAITING" | "RESOLVED" | "ARCHIVED",
  context: AccessContext,
): Promise<void> {
  if (!canAccessCustomerChat(context)) throw new ForbiddenError();

  await db.transaction(async (tx) => {
    await tx
      .update(customerConversations)
      .set({
        status,
        resolvedAt: status === "RESOLVED" ? new Date() : null,
        archivedAt: status === "ARCHIVED" ? new Date() : null,
      })
      .where(eq(customerConversations.id, conversationId));

    await tx.insert(customerConversationEvents).values({
      conversationId,
      action: status,
      performedById: context.user.id,
    });
  });
}

/* ======================================================================
 * Internal chat (staff)
 * ==================================================================== */

/** Stable key for a direct thread, so the same pair always reuse one. */
function directKeyFor(userIds: string[]): string {
  return [...userIds].sort().join(":");
}

export async function openDirectConversation(
  otherUserId: string,
  context: AccessContext,
): Promise<{ conversationId: string }> {
  if (otherUserId === context.user.id) {
    throw new ChatError("You cannot start a conversation with yourself.");
  }

  const other = await db
    .select({ id: users.id, role: users.role, assignedAgentId: users.assignedAgentId })
    .from(users)
    .where(and(eq(users.id, otherUserId), isNull(users.deletedAt), eq(users.status, "ACTIVE")))
    .limit(1);

  if (!other[0]) throw new ChatError("That person is not available.");

  const key = directKeyFor([context.user.id, otherUserId]);

  const existing = await db
    .select({ id: internalConversations.id })
    .from(internalConversations)
    .where(eq(internalConversations.directKey, key))
    .limit(1);

  if (existing[0]) return { conversationId: existing[0].id };

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(internalConversations)
      .values({ type: "DIRECT", directKey: key, createdBy: context.user.id })
      .returning({ id: internalConversations.id });

    const conversation = inserted[0];

    await tx.insert(internalConversationParticipants).values([
      { conversationId: conversation.id, userId: context.user.id },
      { conversationId: conversation.id, userId: otherUserId },
    ]);

    return { conversationId: conversation.id };
  });
}

export async function listInternalConversations(context: AccessContext) {
  const rows = await db
    .select({
      id: internalConversations.id,
      type: internalConversations.type,
      title: internalConversations.title,
      lastMessageAt: internalConversations.lastMessageAt,
      lastReadAt: internalConversationParticipants.lastReadAt,
      lastMessage: raw<string | null>`(
        select m.body from ${internalMessages} m
        where m.conversation_id = ${internalConversations.id} and m.deleted_at is null
        order by m.created_at desc limit 1
      )`,
      unread: raw<number>`(
        select count(*)::int from ${internalMessages} m
        where m.conversation_id = ${internalConversations.id}
          and m.deleted_at is null
          and m.sender_id <> ${context.user.id}
          and (
            ${internalConversationParticipants.lastReadAt} is null
            or m.created_at > ${internalConversationParticipants.lastReadAt}
          )
      )`,
      otherUserIds: raw<string[]>`(
        select coalesce(array_agg(p.user_id::text), '{}')
        from ${internalConversationParticipants} p
        where p.conversation_id = ${internalConversations.id}
          and p.user_id <> ${context.user.id}
      )`,
    })
    .from(internalConversationParticipants)
    .innerJoin(
      internalConversations,
      eq(internalConversations.id, internalConversationParticipants.conversationId),
    )
    .where(
      and(
        eq(internalConversationParticipants.userId, context.user.id),
        isNull(internalConversationParticipants.leftAt),
        isNull(internalConversations.archivedAt),
      ),
    )
    .orderBy(desc(internalConversations.lastMessageAt));

  const people = await loadPeopleMap(rows.flatMap((row) => row.otherUserIds ?? []));

  return rows.map((row) => ({
    ...row,
    unread: Number(row.unread),
    participants: (row.otherUserIds ?? [])
      .map((id) => people.get(id))
      .filter((person): person is NonNullable<typeof person> => Boolean(person)),
  }));
}

export async function getInternalConversation(id: string, context: AccessContext) {
  const membership = await db
    .select({ id: internalConversationParticipants.id })
    .from(internalConversationParticipants)
    .where(
      and(
        eq(internalConversationParticipants.conversationId, id),
        eq(internalConversationParticipants.userId, context.user.id),
        isNull(internalConversationParticipants.leftAt),
      ),
    )
    .limit(1);

  if (!membership[0]) throw new ForbiddenError();

  const messages = await db
    .select({
      id: internalMessages.id,
      body: internalMessages.body,
      createdAt: internalMessages.createdAt,
      editedAt: internalMessages.editedAt,
      senderId: internalMessages.senderId,
      senderName: users.fullName,
      senderAvatar: users.avatarUrl,
    })
    .from(internalMessages)
    .innerJoin(users, eq(users.id, internalMessages.senderId))
    .where(and(eq(internalMessages.conversationId, id), isNull(internalMessages.deletedAt)))
    .orderBy(asc(internalMessages.createdAt))
    .limit(300);

  await db
    .update(internalConversationParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(internalConversationParticipants.conversationId, id),
        eq(internalConversationParticipants.userId, context.user.id),
      ),
    );

  return { messages };
}

export async function sendInternalMessage(
  conversationId: string,
  body: string,
  context: AccessContext,
): Promise<void> {
  if (!body.trim()) throw new ChatError("Write a message before sending.");

  await db.transaction(async (tx) => {
    const participants = await tx
      .select({ userId: internalConversationParticipants.userId })
      .from(internalConversationParticipants)
      .where(
        and(
          eq(internalConversationParticipants.conversationId, conversationId),
          isNull(internalConversationParticipants.leftAt),
        ),
      );

    if (!participants.some((participant) => participant.userId === context.user.id)) {
      throw new ForbiddenError();
    }

    await tx.insert(internalMessages).values({
      conversationId,
      senderId: context.user.id,
      body: body.trim(),
    });

    await tx
      .update(internalConversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(internalConversations.id, conversationId));

    await notifyMany(
      participants
        .map((participant) => participant.userId)
        .filter((userId) => userId !== context.user.id),
      {
        type: "INTERNAL_MESSAGE",
        title: `New message from ${context.user.fullName}`,
        body: body.slice(0, 120),
        href: `/chats/internal?conversation=${conversationId}`,
        entityType: "InternalConversation",
        entityId: conversationId,
      },
      tx,
    );
  });
}

/**
 * Who this user may start an internal conversation with.
 * Admins can reach anyone; agents reach their own fronters and other agents;
 * fronters reach their agent and the admins.
 */
export async function listInternalContacts(context: AccessContext) {
  const conditions: (SQL | undefined)[] = [
    isNull(users.deletedAt),
    eq(users.status, "ACTIVE"),
    ne(users.id, context.user.id),
  ];

  if (context.isFronter) {
    const reachable = [context.managingAgentId].filter((id): id is string => Boolean(id));
    conditions.push(
      or(
        eq(users.role, "SUPER_ADMIN"),
        reachable.length > 0 ? inArray(users.id, reachable) : undefined,
      ),
    );
  } else if (context.isAgent) {
    conditions.push(
      or(
        eq(users.role, "SUPER_ADMIN"),
        eq(users.role, "AGENT"),
        context.teamFronterIds.length > 0 ? inArray(users.id, context.teamFronterIds) : undefined,
      ),
    );
  }

  return db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      avatarUrl: users.avatarUrl,
      jobTitle: users.jobTitle,
      lastSeenAt: userPresence.lastSeenAt,
    })
    .from(users)
    .leftJoin(userPresence, eq(userPresence.userId, users.id))
    .where(and(...conditions))
    .orderBy(users.fullName);
}

/** Coarse presence heartbeat: online means seen in the last two minutes. */
export async function touchPresence(userId: string): Promise<void> {
  await db
    .insert(userPresence)
    .values({ userId, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: userPresence.userId, set: { lastSeenAt: new Date() } });
}

export function isOnline(lastSeenAt: Date | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - lastSeenAt.getTime() < 2 * 60 * 1000;
}

/** New messages since a timestamp, used by the polling transport. */
export async function pollInternalMessages(conversationId: string, since: Date, context: AccessContext) {
  const membership = await db
    .select({ id: internalConversationParticipants.id })
    .from(internalConversationParticipants)
    .where(
      and(
        eq(internalConversationParticipants.conversationId, conversationId),
        eq(internalConversationParticipants.userId, context.user.id),
      ),
    )
    .limit(1);

  if (!membership[0]) throw new ForbiddenError();

  return db
    .select({
      id: internalMessages.id,
      body: internalMessages.body,
      createdAt: internalMessages.createdAt,
      senderId: internalMessages.senderId,
      senderName: users.fullName,
      senderAvatar: users.avatarUrl,
    })
    .from(internalMessages)
    .innerJoin(users, eq(users.id, internalMessages.senderId))
    .where(
      and(
        eq(internalMessages.conversationId, conversationId),
        gt(internalMessages.createdAt, since),
        isNull(internalMessages.deletedAt),
      ),
    )
    .orderBy(asc(internalMessages.createdAt));
}
