"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/layout";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatRelative } from "@/lib/dates";
import {
  heartbeatAction,
  openDirectConversationAction,
  sendInternalMessageAction,
} from "../actions";

/**
 * Staff-to-staff chat. Entirely separate from the customer inbox: different
 * tables, different components, no shared routing.
 */

export type ConversationRow = {
  id: string;
  title: string | null;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  participants: { id: string; fullName: string; avatarUrl: string | null }[];
};

export type MessageRow = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
};

export type ContactRow = {
  id: string;
  fullName: string;
  role: string;
  jobTitle: string | null;
  avatarUrl: string | null;
  online: boolean;
};

export default function InternalChat({
  conversations,
  messages,
  contacts,
  currentUserId,
  selectedId,
}: {
  conversations: ConversationRow[];
  messages: MessageRow[];
  contacts: ContactRow[];
  currentUserId: string;
  selectedId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [showContacts, setShowContacts] = useState(conversations.length === 0);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [selectedId, messages.length]);

  // Poll for new messages, and report presence at the same time.
  useEffect(() => {
    const interval = setInterval(() => {
      void heartbeatAction();
      router.refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [router]);

  function openConversation(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", id);
    router.push(`/chats/internal?${params.toString()}`, { scroll: false });
  }

  function startWith(userId: string) {
    startTransition(async () => {
      const result = await openDirectConversationAction(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setShowContacts(false);
      openConversation(result.data.conversationId);
    });
  }

  function send() {
    if (!selectedId || !body.trim()) return;
    const message = body;

    startTransition(async () => {
      const result = await sendInternalMessageAction(selectedId, message);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="chat-layout">
      <aside className="chat-list" aria-label="Conversations">
        <div style={{ padding: 10, borderBottom: "1px solid var(--border)" }}>
          <button
            type="button"
            className="btn btn--secondary btn--sm btn--block"
            onClick={() => setShowContacts((value) => !value)}
            aria-expanded={showContacts}
          >
            {showContacts ? "Back to conversations" : "New message"}
          </button>
        </div>

        {showContacts
          ? contacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                className="chat-list-item"
                onClick={() => startWith(contact.id)}
                disabled={pending}
              >
                <span className="person">
                  <Avatar name={contact.fullName} src={contact.avatarUrl} size="sm" />
                  <span>
                    <span className="person-name">{contact.fullName}</span>
                    <span className="table-secondary" style={{ display: "block" }}>
                      {contact.jobTitle ?? contact.role.replace(/_/g, " ").toLowerCase()}
                      {contact.online && (
                        <span style={{ color: "var(--status-positive-fg)" }}> · online</span>
                      )}
                    </span>
                  </span>
                </span>
              </button>
            ))
          : conversations.map((conversation) => {
              const label =
                conversation.title ??
                conversation.participants.map((person) => person.fullName).join(", ") ??
                "Conversation";

              return (
                <button
                  key={conversation.id}
                  type="button"
                  className="chat-list-item"
                  aria-current={selectedId === conversation.id}
                  onClick={() => openConversation(conversation.id)}
                >
                  <div className="row row--between">
                    <span className="person">
                      <Avatar
                        name={label}
                        src={conversation.participants[0]?.avatarUrl ?? null}
                        size="sm"
                      />
                      <span
                        className="person-name"
                        style={{ fontWeight: conversation.unread > 0 ? 700 : 600 }}
                      >
                        {label}
                      </span>
                    </span>
                    {conversation.unread > 0 && (
                      <span className="sidebar-link-badge">{conversation.unread}</span>
                    )}
                  </div>

                  <div className="truncate small muted" style={{ marginTop: 4 }}>
                    {conversation.lastMessage ?? "No messages yet"}
                  </div>
                  <div className="subtle" style={{ fontSize: "0.7rem", marginTop: 2 }}>
                    {formatRelative(conversation.lastMessageAt)}
                  </div>
                </button>
              );
            })}
      </aside>

      <section className="chat-thread">
        {!selectedId ? (
          <EmptyState
            icon={<MessageCircle size={18} />}
            title="No conversation selected"
            message="Pick a conversation, or start a new one with someone on your team."
          />
        ) : (
          <>
            <div className="chat-messages" ref={messagesRef}>
              {messages.length === 0 && (
                <p className="subtle small" style={{ textAlign: "center", padding: 24 }}>
                  No messages yet. Say hello.
                </p>
              )}

              {messages.map((message) => {
                const mine = message.senderId === currentUserId;
                return (
                  <div
                    key={message.id}
                    className={mine ? "chat-bubble chat-bubble--out" : "chat-bubble chat-bubble--in"}
                  >
                    {!mine && (
                      <div style={{ fontWeight: 600, fontSize: "0.76rem", marginBottom: 2 }}>
                        {message.senderName}
                      </div>
                    )}
                    <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>
                    <div className="chat-meta">{formatDateTime(message.createdAt)}</div>
                  </div>
                );
              })}
            </div>

            <div className="chat-composer">
              <textarea
                className="textarea"
                rows={2}
                style={{ flex: 1 }}
                value={body}
                placeholder="Write a message..."
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") send();
                }}
              />
              <button
                type="button"
                className="btn btn--primary"
                onClick={send}
                disabled={pending || !body.trim()}
                aria-label="Send message"
              >
                {pending ? <span className="spinner" aria-hidden="true" /> : <Send size={15} />}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
