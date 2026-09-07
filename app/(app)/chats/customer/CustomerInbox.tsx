"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Check, MessagesSquare, Send, StickyNote } from "lucide-react";
import { EmptyState } from "@/components/ui/layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { formatDateTime, formatRelative } from "@/lib/dates";
import { displayPhone } from "@/lib/phone";
import {
  assignConversationAction,
  replyToCustomerAction,
  setConversationStatusAction,
} from "../actions";

/**
 * The customer inbox.
 *
 * Website enquiries only ever land here, with agents and admins as the
 * audience. Staff can also leave an internal note on a thread, which is
 * stored on the conversation but never sent to the visitor.
 */

export type ConversationSummary = {
  id: string;
  visitorName: string | null;
  subject: string | null;
  status: string;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  assignedAgentName: string | null;
  isMine: boolean;
  propertyId: string | null;
  propertyReference: string | null;
};

export type ThreadMessage = {
  id: string;
  sender: "VISITOR" | "STAFF" | "SYSTEM";
  senderName: string | null;
  body: string;
  isInternalNote: boolean;
  createdAt: string;
};

export type ThreadDetail = {
  id: string;
  visitorName: string | null;
  visitorEmail: string | null;
  visitorPhone: string | null;
  subject: string | null;
  status: string;
  propertyId: string | null;
  propertyTitle: string | null;
  assignedAgentName: string | null;
  messages: ThreadMessage[];
};

export default function CustomerInbox({
  conversations,
  thread,
  agents,
}: {
  conversations: ConversationSummary[];
  thread: ThreadDetail | null;
  agents: { id: string; fullName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view when the thread changes or grows.
  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [thread?.id, thread?.messages.length]);

  // Poll while the inbox is open so a new enquiry appears without a reload.
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(interval);
  }, [router]);

  function selectConversation(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", id);
    router.push(`/chats/customer?${params.toString()}`, { scroll: false });
  }

  function send() {
    if (!thread || !body.trim()) return;
    const message = body;
    const asNote = isNote;

    startTransition(async () => {
      const result = await replyToCustomerAction(thread.id, message, asNote);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setBody("");
      setIsNote(false);
      router.refresh();
    });
  }

  function updateStatus(status: "RESOLVED" | "ARCHIVED" | "OPEN") {
    if (!thread) return;
    startTransition(async () => {
      const result = await setConversationStatusAction(thread.id, status);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Conversation marked ${status.toLowerCase()}.`);
      router.refresh();
    });
  }

  function assign(userId: string) {
    if (!thread || !userId) return;
    startTransition(async () => {
      const result = await assignConversationAction(thread.id, userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation assigned.");
      router.refresh();
    });
  }

  return (
    <div className="chat-layout">
      <aside className="chat-list" aria-label="Conversations">
        {conversations.length === 0 ? (
          <div style={{ padding: 16 }}>
            <p className="subtle small">No conversations yet.</p>
          </div>
        ) : (
          conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className="chat-list-item"
              aria-current={thread?.id === conversation.id}
              onClick={() => selectConversation(conversation.id)}
            >
              <div className="row row--between">
                <span style={{ fontWeight: conversation.unread > 0 ? 700 : 600 }}>
                  {conversation.visitorName ?? "Website visitor"}
                </span>
                {conversation.unread > 0 && (
                  <span className="sidebar-link-badge">{conversation.unread}</span>
                )}
              </div>

              {conversation.subject && (
                <div className="table-secondary truncate">{conversation.subject}</div>
              )}

              <div className="truncate small muted" style={{ marginTop: 2 }}>
                {conversation.lastMessage ?? "No messages yet"}
              </div>

              <div className="row row--between" style={{ marginTop: 6 }}>
                <StatusBadge status={conversation.status} />
                <span className="subtle" style={{ fontSize: "0.7rem" }}>
                  {formatRelative(conversation.lastMessageAt)}
                </span>
              </div>
            </button>
          ))
        )}
      </aside>

      <section className="chat-thread">
        {!thread ? (
          <EmptyState
            icon={<MessagesSquare size={18} />}
            title="Choose a conversation"
            message="Website enquiries arrive here and are routed to the agent who published the property."
          />
        ) : (
          <>
            <header
              className="row row--between"
              style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", gap: 12 }}
            >
              <div style={{ minWidth: 0 }}>
                <div className="row">
                  <strong>{thread.visitorName ?? "Website visitor"}</strong>
                  <StatusBadge status={thread.status} />
                </div>
                <div className="table-secondary truncate">
                  {thread.visitorEmail && <span>{thread.visitorEmail} · </span>}
                  {thread.visitorPhone && (
                    <span className="numeric">{displayPhone(null, thread.visitorPhone)} · </span>
                  )}
                  {thread.propertyId ? (
                    <Link href={`/properties/${thread.propertyId}`}>
                      {thread.propertyTitle ?? "View property"}
                    </Link>
                  ) : (
                    "General enquiry"
                  )}
                </div>
              </div>

              <div className="row">
                <select
                  className="select"
                  style={{ width: "auto", minWidth: 150 }}
                  aria-label="Assign conversation"
                  value=""
                  onChange={(event) => assign(event.target.value)}
                  disabled={pending}
                >
                  <option value="">
                    {thread.assignedAgentName
                      ? `Assigned: ${thread.assignedAgentName}`
                      : "Unassigned"}
                  </option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      Assign to {agent.fullName}
                    </option>
                  ))}
                </select>

                {thread.status !== "RESOLVED" ? (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => updateStatus("RESOLVED")}
                    disabled={pending}
                  >
                    <Check size={14} />
                    Resolve
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => updateStatus("OPEN")}
                    disabled={pending}
                  >
                    Reopen
                  </button>
                )}
              </div>
            </header>

            <div className="chat-messages" ref={messagesRef}>
              {thread.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.isInternalNote
                      ? "chat-bubble chat-bubble--note"
                      : message.sender === "VISITOR"
                        ? "chat-bubble chat-bubble--in"
                        : "chat-bubble chat-bubble--out"
                  }
                >
                  {message.isInternalNote && (
                    <div className="row" style={{ marginBottom: 4 }}>
                      <StickyNote size={12} />
                      <strong style={{ fontSize: "0.72rem" }}>
                        Internal note - not sent to the visitor
                      </strong>
                    </div>
                  )}

                  <div style={{ whiteSpace: "pre-wrap" }}>{message.body}</div>

                  <div className="chat-meta">
                    {message.sender === "STAFF" && message.senderName
                      ? `${message.senderName} · `
                      : ""}
                    {formatDateTime(message.createdAt)}
                  </div>
                </div>
              ))}
            </div>

            <div className="chat-composer">
              <div style={{ flex: 1 }}>
                <textarea
                  className="textarea"
                  rows={2}
                  value={body}
                  placeholder={
                    isNote
                      ? "Internal note. The visitor will not see this."
                      : "Write a reply to the visitor..."
                  }
                  onChange={(event) => setBody(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") send();
                  }}
                />
                <label className="checkbox-row" style={{ marginTop: 6 }}>
                  <input
                    type="checkbox"
                    checked={isNote}
                    onChange={(event) => setIsNote(event.target.checked)}
                  />
                  Internal note
                </label>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                onClick={send}
                disabled={pending || !body.trim()}
                aria-label={isNote ? "Save internal note" : "Send reply"}
              >
                {pending ? (
                  <span className="spinner" aria-hidden="true" />
                ) : isNote ? (
                  <StickyNote size={15} />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
