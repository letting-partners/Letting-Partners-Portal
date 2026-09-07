import type { Metadata } from "next";
import { pageAccess } from "@/lib/auth/page-guard";
import { PageHeader } from "@/components/ui/layout";
import {
  getInternalConversation,
  isOnline,
  listInternalContacts,
  listInternalConversations,
} from "@/services/chat";
import InternalChat from "./InternalChat";

export const metadata: Metadata = { title: "Internal chat" };

export default async function InternalChatPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const context = await pageAccess();
  const params = await searchParams;

  const [conversations, contacts] = await Promise.all([
    listInternalConversations(context),
    listInternalContacts(context),
  ]);

  const selectedId = params.conversation ?? conversations[0]?.id ?? null;

  const thread = selectedId
    ? await getInternalConversation(selectedId, context).catch(() => null)
    : null;

  return (
    <>
      <PageHeader
        title="Internal chat"
        subtitle="Staff conversations. Completely separate from customer enquiries."
      />

      <InternalChat
        currentUserId={context.user.id}
        selectedId={selectedId}
        conversations={conversations.map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          unread: conversation.unread,
          participants: conversation.participants.map((person) => ({
            id: person.id,
            fullName: person.fullName,
            avatarUrl: person.avatarUrl,
          })),
        }))}
        messages={(thread?.messages ?? []).map((message) => ({
          id: message.id,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          senderId: message.senderId,
          senderName: message.senderName,
          senderAvatar: message.senderAvatar,
        }))}
        contacts={contacts.map((contact) => ({
          id: contact.id,
          fullName: contact.fullName,
          role: contact.role,
          jobTitle: contact.jobTitle,
          avatarUrl: contact.avatarUrl,
          online: isOnline(contact.lastSeenAt),
        }))}
      />
    </>
  );
}
