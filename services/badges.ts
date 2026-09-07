import "server-only";
import { and, count, eq, isNull, lte, or, sql as raw } from "drizzle-orm";
import { db } from "@/db";
import {
  collaborations,
  customerConversations,
  followUps,
  internalConversationParticipants,
  internalConversations,
  internalMessages,
  notifications,
} from "@/db/schema";
import { followUpVisibilityFilter, type AccessContext } from "./permissions";

/**
 * The counters shown on the sidebar. Deliberately one small parallel batch of
 * count queries rather than loading rows, because this runs on every page.
 */

export type ShellBadges = {
  followUpsDue: number;
  customerChats: number;
  internalChats: number;
  notifications: number;
  crossSell: number;
};

const EMPTY: ShellBadges = {
  followUpsDue: 0,
  customerChats: 0,
  internalChats: 0,
  notifications: 0,
  crossSell: 0,
};

export async function getShellBadges(context: AccessContext): Promise<ShellBadges> {
  const now = new Date();

  try {
    const [followUpRows, notificationRows, customerRows, internalRows, crossSellRows] =
      await Promise.all([
        /* Follow-ups that are due now or overdue, within this user's scope. */
        db
          .select({ value: count() })
          .from(followUps)
          .where(
            and(
              eq(followUps.status, "SCHEDULED"),
              lte(followUps.dueAt, now),
              followUpVisibilityFilter(context),
            ),
          ),

        db
          .select({ value: count() })
          .from(notifications)
          .where(and(eq(notifications.userId, context.user.id), isNull(notifications.readAt))),

        /* Customer chats never reach fronters. */
        context.isFronter
          ? Promise.resolve([{ value: 0 }])
          : db
              .select({ value: count() })
              .from(customerConversations)
              .where(
                and(
                  raw`${customerConversations.status} in ('NEW','OPEN','WAITING')`,
                  context.isAdmin
                    ? undefined
                    : or(
                        eq(customerConversations.assignedAgentId, context.user.id),
                        isNull(customerConversations.assignedAgentId),
                      ),
                ),
              ),

        /* Internal threads with a message newer than this user last read. */
        db
          .select({ value: count() })
          .from(internalConversationParticipants)
          .innerJoin(
            internalConversations,
            eq(internalConversations.id, internalConversationParticipants.conversationId),
          )
          .where(
            and(
              eq(internalConversationParticipants.userId, context.user.id),
              isNull(internalConversationParticipants.leftAt),
              raw`exists (
                select 1 from ${internalMessages} m
                where m.conversation_id = ${internalConversations.id}
                  and m.sender_id <> ${context.user.id}
                  and m.deleted_at is null
                  and (
                    ${internalConversationParticipants.lastReadAt} is null
                    or m.created_at > ${internalConversationParticipants.lastReadAt}
                  )
              )`,
            ),
          ),

        /* Cross-sell requests waiting on this agent to accept or decline. */
        context.isFronter
          ? Promise.resolve([{ value: 0 }])
          : db
              .select({ value: count() })
              .from(collaborations)
              .where(
                and(
                  eq(collaborations.status, "PENDING"),
                  context.isAdmin
                    ? undefined
                    : eq(collaborations.propertyAgentId, context.user.id),
                ),
              ),
      ]);

    return {
      followUpsDue: Number(followUpRows[0]?.value ?? 0),
      notifications: Number(notificationRows[0]?.value ?? 0),
      customerChats: Number(customerRows[0]?.value ?? 0),
      internalChats: Number(internalRows[0]?.value ?? 0),
      crossSell: Number(crossSellRows[0]?.value ?? 0),
    };
  } catch (error) {
    // A counter is decoration. It must never take the whole shell down.
    console.error("Failed to load sidebar badges:", error);
    return EMPTY;
  }
}
