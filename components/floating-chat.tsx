"use client";

import { useEffect, useRef, useState, FormEvent } from "react";

type Contact = {
  id: string;
  name: string;
  email: string;
  role?: string;
  profilePicture?: string | null;
};

type Message = {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  fromUserId: string;
};

type ConversationMeta = {
  agent?: { id: string; name: string; email: string };
  user?: Contact;
  lastMessage: { content: string; createdAt: string; fromUserId: string } | null;
  unreadCount: number;
};

type Props = {
  userId: string;
  contacts: Contact[];
  isAdmin?: boolean;
};

function getInitials(name: string | null | undefined): string {
  return (
    (name || "?")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

export function FloatingChat({ userId, contacts, isAdmin = false }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      // silently ignore
    }
  }

  async function fetchMessages(contactId: string) {
    try {
      const res = await fetch(`/api/chat/messages?agentId=${contactId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // silently ignore
    }
  }

  // Poll conversations (for unread badge) always
  useEffect(() => {
    fetchConversations();
    convPollRef.current = setInterval(fetchConversations, 6000);
    return () => {
      if (convPollRef.current) clearInterval(convPollRef.current);
    };
  }, []);

  // Poll messages when contact selected and popup open
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selected || !open) { return; }

    setLoadingMsgs(true);
    fetchMessages(selected.id).then(() => setLoadingMsgs(false));

    pollRef.current = setInterval(() => {
      fetchMessages(selected.id);
      fetchConversations();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selected || sending) return;
    setSending(true);
    const content = input.trim();
    setInput("");
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selected.id, content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
  }

  // Merge conversation metadata with contacts list
  const contactsWithMeta = contacts.map((contact) => {
    const found = conversations.find((c) => {
      const id = isAdmin ? c.agent?.id : c.user?.id;
      return id === contact.id;
    });
    return {
      contact,
      lastMessage: found?.lastMessage ?? null,
      unreadCount: found?.unreadCount ?? 0,
    };
  });

  // Sort: unread first, then by lastMessage date
  const sorted = [...contactsWithMeta].sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <>
      {/* Floating button */}
      <button
        className="fchat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat"
        title="Messages"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 0 0 1.28.53l3.58-3.579a.78.78 0 0 1 .527-.224 41.202 41.202 0 0 0 5.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm5 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
        {totalUnread > 0 && (
          <span className="fchat-fab-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
        )}
      </button>

      {/* Popup */}
      {open && (
        <div className="fchat-popup">
          <div className="fchat-popup-header">
            {selected ? (
              <>
                <button
                  className="fchat-back-btn"
                  onClick={() => { setSelected(null); setMessages([]); }}
                  aria-label="Back to contacts"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                    <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="fchat-popup-avatar">
                  {selected.profilePicture
                    ? <img src={selected.profilePicture} alt={selected.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : getInitials(selected.name)}
                </div>
                <div className="fchat-popup-contact-info">
                  <div className="fchat-popup-contact-name">{selected.name}</div>
                  <div className="fchat-popup-contact-meta">{selected.role ?? selected.email}</div>
                </div>
              </>
            ) : (
              <h3 className="fchat-popup-title">
                Messages
                {totalUnread > 0 && (
                  <span className="fchat-fab-badge fchat-fab-badge-inline">{totalUnread}</span>
                )}
              </h3>
            )}
            <button
              className="fchat-close-btn"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          {!selected ? (
            /* Contact list */
            <div className="fchat-contact-list">
              {sorted.length === 0 && (
                <p className="fchat-empty">No contacts available.</p>
              )}
              {sorted.map(({ contact, lastMessage, unreadCount }) => (
                <button
                  key={contact.id}
                  className="fchat-contact-item"
                  onClick={() => setSelected(contact)}
                >
                  <div className="fchat-contact-avatar">
                    {contact.profilePicture
                      ? <img src={contact.profilePicture} alt={contact.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                      : getInitials(contact.name)}
                  </div>
                  <div className="fchat-contact-info">
                    <div className="fchat-contact-name">
                      {contact.name}
                      {contact.role && (
                        <span className="fchat-contact-role">{contact.role === "ADMIN" ? "Admin" : "Agent"}</span>
                      )}
                    </div>
                    {lastMessage ? (
                      <div className="fchat-contact-preview">
                        {lastMessage.fromUserId === userId ? "You: " : ""}
                        {lastMessage.content.length > 35
                          ? lastMessage.content.slice(0, 35) + "…"
                          : lastMessage.content}
                      </div>
                    ) : (
                      <div className="fchat-contact-preview fchat-contact-preview-empty">No messages yet</div>
                    )}
                  </div>
                  <div className="fchat-contact-right">
                    {lastMessage && (
                      <div className="fchat-contact-time">{formatTime(lastMessage.createdAt)}</div>
                    )}
                    {unreadCount > 0 && (
                      <div className="fchat-unread-dot">{unreadCount}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            /* Conversation */
            <div className="fchat-messages-wrap">
              <div className="fchat-messages">
                {loadingMsgs && messages.length === 0 && (
                  <p className="fchat-messages-empty">Loading…</p>
                )}
                {!loadingMsgs && messages.length === 0 && (
                  <p className="fchat-messages-empty">No messages yet. Start the conversation!</p>
                )}
                {messages.map((msg) => {
                  const isMe = msg.fromUserId === userId;
                  return (
                    <div key={msg.id} className={`fchat-bubble-row${isMe ? " fchat-bubble-row-me" : ""}`}>
                      <div className={`fchat-bubble${isMe ? " fchat-bubble-me" : " fchat-bubble-them"}`}>
                        <p className="fchat-bubble-text">{msg.content}</p>
                        <span className="fchat-bubble-time">{formatTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <form className="fchat-input-bar" onSubmit={sendMessage}>
                <input
                  className="input fchat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message ${selected.name}…`}
                  autoComplete="off"
                  disabled={sending}
                />
                <button
                  className="btn btn-primary fchat-send-btn"
                  type="submit"
                  disabled={sending || !input.trim()}
                >
                  {sending ? "…" : "Send"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
