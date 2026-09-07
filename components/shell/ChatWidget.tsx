"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Plus, Send, StickyNote, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatRelative } from "@/lib/dates";
import {
  heartbeatAction,
  openDirectConversationAction,
  replyToCustomerAction,
  sendInternalMessageAction,
} from "@/app/(app)/chats/actions";
import {
  widgetContacts,
  widgetCustomerList,
  widgetCustomerThread,
  widgetInternalList,
  widgetInternalThread,
  widgetSummary,
  type WidgetContact,
  type WidgetConversation,
  type WidgetMessage,
} from "@/app/(app)/chats/widget-actions";

/**
 * The floating chat launcher.
 *
 * Chat is something you dip into while doing something else, so it lives in a
 * corner popup rather than a page you have to navigate away to. Both systems
 * are here, but as separate tabs that share no state - a customer message and
 * an internal message can never be sent down the wrong pipe.
 */

type Tab = "customer" | "internal";
type View = { kind: "list" } | { kind: "thread"; id: string; title: string } | { kind: "contacts" };

const POLL_OPEN_MS = 8000;
const POLL_CLOSED_MS = 60_000;

export default function ChatWidget({ canUseCustomer }: { canUseCustomer: boolean }) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(canUseCustomer ? "customer" : "internal");
  const [view, setView] = useState<View>({ kind: "list" });

  const [summary, setSummary] = useState({ customerUnread: 0, internalUnread: 0 });
  const [conversations, setConversations] = useState<WidgetConversation[]>([]);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [contacts, setContacts] = useState<WidgetContact[]>([]);

  const [body, setBody] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesRef = useRef<HTMLDivElement>(null);
  const totalUnread = summary.customerUnread + summary.internalUnread;

  /* ------------------------------------------------------------- loading */

  const refreshSummary = useCallback(async () => {
    const next = await widgetSummary();
    setSummary({ customerUnread: next.customerUnread, internalUnread: next.internalUnread });
  }, []);

  const refreshList = useCallback(async (which: Tab) => {
    const rows = which === "customer" ? await widgetCustomerList() : await widgetInternalList();
    setConversations(rows);
  }, []);

  const refreshThread = useCallback(async (which: Tab, id: string) => {
    const rows =
      which === "customer" ? await widgetCustomerThread(id) : await widgetInternalThread(id);
    setMessages(rows);
  }, []);

  // The badge stays current even while the panel is shut, just less often.
  useEffect(() => {
    void refreshSummary();
    const interval = setInterval(
      () => void refreshSummary(),
      open ? POLL_OPEN_MS : POLL_CLOSED_MS,
    );
    return () => clearInterval(interval);
  }, [open, refreshSummary]);

  useEffect(() => {
    if (!open) return;
    if (view.kind === "list") void refreshList(tab);
    if (view.kind === "thread") void refreshThread(tab, view.id);
    if (view.kind === "contacts") void widgetContacts().then(setContacts);
  }, [open, tab, view, refreshList, refreshThread]);

  // Poll the open view, and report presence while the user is here.
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      void heartbeatAction();
      if (view.kind === "list") void refreshList(tab);
      if (view.kind === "thread") void refreshThread(tab, view.id);
    }, POLL_OPEN_MS);
    return () => clearInterval(interval);
  }, [open, tab, view, refreshList, refreshThread]);

  useEffect(() => {
    const element = messagesRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  // Escape closes the panel, as with any other overlay.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* -------------------------------------------------------------- actions */

  function send() {
    if (view.kind !== "thread" || !body.trim()) return;
    const message = body;
    const asNote = isNote;
    const { id } = view;

    setSending(true);
    startTransition(async () => {
      const result =
        tab === "customer"
          ? await replyToCustomerAction(id, message, asNote)
          : await sendInternalMessageAction(id, message);

      setSending(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setBody("");
      setIsNote(false);
      await refreshThread(tab, id);
      void refreshSummary();
    });
  }

  function startWith(contact: WidgetContact) {
    startTransition(async () => {
      const result = await openDirectConversationAction(contact.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setView({ kind: "thread", id: result.data.conversationId, title: contact.fullName });
    });
  }

  function switchTab(next: Tab) {
    setTab(next);
    setView({ kind: "list" });
    setMessages([]);
  }

  /* --------------------------------------------------------------- view */

  return (
    <>
      <button
        type="button"
        className="chat-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          totalUnread > 0 ? `Chat, ${totalUnread} unread messages` : "Chat"
        }
      >
        {open ? <X size={20} /> : <MessageSquare size={20} />}
        {!open && totalUnread > 0 && (
          <span className="chat-launcher-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
        )}
      </button>

      {open && (
        <section className="chat-popup" role="dialog" aria-label="Chat">
          <header className="chat-popup-header">
            {view.kind === "list" ? (
              <strong>Chat</strong>
            ) : (
              <button
                type="button"
                className="chat-popup-back"
                onClick={() => setView({ kind: "list" })}
              >
                <ArrowLeft size={15} />
                <span className="truncate">
                  {view.kind === "thread" ? view.title : "New message"}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="chat-popup-close"
            >
              <X size={16} />
            </button>
          </header>

          {view.kind === "list" && (
            <nav className="chat-popup-tabs" role="tablist">
              {canUseCustomer && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "customer"}
                  onClick={() => switchTab("customer")}
                >
                  Customers
                  {summary.customerUnread > 0 && (
                    <span className="chat-tab-badge">{summary.customerUnread}</span>
                  )}
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={tab === "internal"}
                onClick={() => switchTab("internal")}
              >
                Team
                {summary.internalUnread > 0 && (
                  <span className="chat-tab-badge">{summary.internalUnread}</span>
                )}
              </button>
            </nav>
          )}

          <div className="chat-popup-body">
            {view.kind === "list" && (
              <>
                {conversations.length === 0 ? (
                  <p className="chat-popup-empty">
                    {tab === "customer"
                      ? "No website enquiries yet. They arrive here when a visitor messages about a property."
                      : "No conversations yet. Start one with someone on your team."}
                  </p>
                ) : (
                  <ul>
                    {conversations.map((conversation) => (
                      <li key={conversation.id}>
                        <button
                          type="button"
                          className="chat-popup-item"
                          onClick={() =>
                            setView({
                              kind: "thread",
                              id: conversation.id,
                              title: conversation.title,
                            })
                          }
                        >
                          <span className="row row--between">
                            <span
                              className="truncate"
                              style={{ fontWeight: conversation.unread > 0 ? 700 : 600 }}
                            >
                              {conversation.title}
                            </span>
                            {conversation.unread > 0 && (
                              <span className="chat-tab-badge">{conversation.unread}</span>
                            )}
                          </span>
                          {conversation.subtitle && (
                            <span className="chat-popup-sub truncate">{conversation.subtitle}</span>
                          )}
                          <span className="chat-popup-preview truncate">
                            {conversation.preview ?? "No messages yet"}
                          </span>
                          <span className="chat-popup-time">{formatRelative(conversation.at)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {view.kind === "contacts" && (
              <ul>
                {contacts.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      className="chat-popup-item"
                      onClick={() => startWith(contact)}
                    >
                      <span className="truncate" style={{ fontWeight: 600 }}>
                        {contact.fullName}
                      </span>
                      <span className="chat-popup-sub truncate">
                        {contact.role}
                        {contact.online && (
                          <span style={{ color: "var(--status-positive-fg)" }}> · online</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {view.kind === "thread" && (
              <div className="chat-popup-messages" ref={messagesRef}>
                {messages.length === 0 && <p className="chat-popup-empty">No messages yet.</p>}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={
                      message.isInternalNote
                        ? "chat-bubble chat-bubble--note"
                        : message.mine
                          ? "chat-bubble chat-bubble--out"
                          : "chat-bubble chat-bubble--in"
                    }
                  >
                    {message.isInternalNote && (
                      <strong style={{ display: "block", fontSize: "0.7rem", marginBottom: 2 }}>
                        Internal note
                      </strong>
                    )}
                    {!message.mine && message.authorName && (
                      <strong style={{ display: "block", fontSize: "0.72rem" }}>
                        {message.authorName}
                      </strong>
                    )}
                    <span style={{ whiteSpace: "pre-wrap" }}>{message.body}</span>
                    <span className="chat-meta">{formatRelative(message.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {view.kind === "thread" && (
            <div className="chat-popup-composer">
              <textarea
                className="textarea"
                rows={2}
                value={body}
                placeholder={
                  isNote ? "Internal note, not sent to the visitor" : "Write a message..."
                }
                onChange={(event) => setBody(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") send();
                }}
              />
              <div className="chat-popup-composer-actions">
                {tab === "customer" && (
                  <button
                    type="button"
                    className={isNote ? "btn btn--secondary btn--sm" : "btn btn--ghost btn--sm"}
                    onClick={() => setIsNote((value) => !value)}
                    aria-pressed={isNote}
                    title="Leave an internal note instead of replying"
                  >
                    <StickyNote size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  onClick={send}
                  disabled={sending || !body.trim()}
                >
                  {sending ? <span className="spinner" aria-hidden="true" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          )}

          {view.kind === "list" && (
            <footer className="chat-popup-footer">
              {tab === "internal" ? (
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => setView({ kind: "contacts" })}
                >
                  <Plus size={14} />
                  New message
                </button>
              ) : (
                <span />
              )}

              <Link
                href={tab === "customer" ? "/chats/customer" : "/chats/internal"}
                className="btn btn--ghost btn--sm"
                onClick={() => setOpen(false)}
              >
                Open full view
              </Link>
            </footer>
          )}
        </section>
      )}
    </>
  );
}
