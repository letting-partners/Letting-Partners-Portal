"use server";

import { getAccessContext } from "@/services/permissions";
import {
  getCustomerConversation,
  getInternalConversation,
  isOnline,
  listCustomerConversations,
  listInternalContacts,
  listInternalConversations,
} from "@/services/chat";

/**
 * Read paths for the floating chat widget.
 *
 * The widget polls while it is open, so every one of these returns a plain,
 * already-serialised shape and never throws: a transient failure should leave
 * the last view on screen rather than tearing the widget down.
 */

export type WidgetConversation = {
  id: string;
  title: string;
  subtitle: string | null;
  preview: string | null;
  unread: number;
  at: string;
  status?: string;
};

export type WidgetMessage = {
  id: string;
  body: string;
  mine: boolean;
  authorName: string | null;
  at: string;
  isInternalNote?: boolean;
};

export type WidgetContact = {
  id: string;
  fullName: string;
  role: string;
  online: boolean;
};

export type WidgetSummary = {
  customerUnread: number;
  internalUnread: number;
  canUseCustomer: boolean;
};

export async function widgetSummary(): Promise<WidgetSummary> {
  const context = await getAccessContext();
  if (!context) return { customerUnread: 0, internalUnread: 0, canUseCustomer: false };

  try {
    const internal = await listInternalConversations(context);
    const internalUnread = internal.reduce((total, row) => total + row.unread, 0);

    if (context.isFronter) {
      return { customerUnread: 0, internalUnread, canUseCustomer: false };
    }

    const customer = await listCustomerConversations(context, {});
    const customerUnread = customer.rows.reduce((total, row) => total + row.unread, 0);

    return { customerUnread, internalUnread, canUseCustomer: true };
  } catch (error) {
    console.error("Chat widget summary failed:", error);
    return { customerUnread: 0, internalUnread: 0, canUseCustomer: !context.isFronter };
  }
}

export async function widgetCustomerList(): Promise<WidgetConversation[]> {
  const context = await getAccessContext();
  if (!context || context.isFronter) return [];

  try {
    const inbox = await listCustomerConversations(context, {});
    return inbox.rows.map((row) => ({
      id: row.id,
      title: row.visitorName ?? "Website visitor",
      subtitle: row.subject,
      preview: row.lastMessage,
      unread: row.unread,
      at: row.lastMessageAt.toISOString(),
      status: row.status,
    }));
  } catch (error) {
    console.error("Chat widget customer list failed:", error);
    return [];
  }
}

export async function widgetCustomerThread(conversationId: string): Promise<WidgetMessage[]> {
  const context = await getAccessContext();
  if (!context || context.isFronter) return [];

  try {
    const thread = await getCustomerConversation(conversationId, context);
    if (!thread) return [];

    return thread.messages.map((message) => ({
      id: message.id,
      body: message.body,
      // A staff message is "mine" for bubble alignment: the visitor is the
      // other party, whichever colleague actually typed it.
      mine: message.sender === "STAFF",
      authorName: message.senderName,
      at: message.createdAt.toISOString(),
      isInternalNote: message.isInternalNote,
    }));
  } catch (error) {
    console.error("Chat widget customer thread failed:", error);
    return [];
  }
}

export async function widgetInternalList(): Promise<WidgetConversation[]> {
  const context = await getAccessContext();
  if (!context) return [];

  try {
    const conversations = await listInternalConversations(context);
    return conversations.map((row) => ({
      id: row.id,
      title: row.title ?? row.participants.map((p) => p.fullName).join(", ") ?? "Conversation",
      subtitle: null,
      preview: row.lastMessage,
      unread: row.unread,
      at: row.lastMessageAt.toISOString(),
    }));
  } catch (error) {
    console.error("Chat widget internal list failed:", error);
    return [];
  }
}

export async function widgetInternalThread(conversationId: string): Promise<WidgetMessage[]> {
  const context = await getAccessContext();
  if (!context) return [];

  try {
    const thread = await getInternalConversation(conversationId, context);
    return thread.messages.map((message) => ({
      id: message.id,
      body: message.body,
      mine: message.senderId === context.user.id,
      authorName: message.senderName,
      at: message.createdAt.toISOString(),
    }));
  } catch (error) {
    console.error("Chat widget internal thread failed:", error);
    return [];
  }
}

export async function widgetContacts(): Promise<WidgetContact[]> {
  const context = await getAccessContext();
  if (!context) return [];

  try {
    const contacts = await listInternalContacts(context);
    return contacts.map((contact) => ({
      id: contact.id,
      fullName: contact.fullName,
      role: contact.jobTitle ?? contact.role.replace(/_/g, " ").toLowerCase(),
      online: isOnline(contact.lastSeenAt),
    }));
  } catch (error) {
    console.error("Chat widget contacts failed:", error);
    return [];
  }
}
