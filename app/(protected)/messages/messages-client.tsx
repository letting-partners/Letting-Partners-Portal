"use client";

import { useEffect, useRef, useState, FormEvent } from "react";

type Contact = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  profilePicture?: string | null;
};

type Message = {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  fromUserId: string;
  fromUser: { agentDisplayName: string; role: string };
};

type ConversationMeta = {
  user: Contact;
  lastMessage: { content: string; createdAt: string; fromUserId: string } | null;
  unreadCount: number;
};

type Props = {
  agentId: string;
  contacts: Contact[];
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

export function AgentMessagesClient({ agentId, contacts }: Props) {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
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

  async function fetchMessages(userId: string) {
    try {
      const res = await fetch(`/api/chat/messages?userId=${userId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } catch {
      // silently ignore
    }
  }

  // Initial conversations load + poll every 5s
  useEffect(() => {
    fetchConversations();
    convPollRef.current = setInterval(fetchConversations, 5000);
    return () => {
      if (convPollRef.current) clearInterval(convPollRef.current);
    };
  }, []);

  // When contact selected: load messages + start polling
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedContact) { setMessages([]); return; }

    setLoadingMessages(true);
    fetchMessages(selectedContact.id).then(() => setLoadingMessages(false));

    pollRef.current = setInterval(() => {
      fetchMessages(selectedContact.id);
      fetchConversations();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContact?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedContact || sending) return;

    setSending(true);
    const content = messageInput.trim();
    setMessageInput("");

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selectedContact.id, content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
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

  // Merge contacts with conversation metadata
  const contactsWithMeta: ConversationMeta[] = contacts.map((contact) => {
    const found = conversations.find((c) => c.user.id === contact.id);
    return found ?? { user: contact, lastMessage: null, unreadCount: 0 };
  });

  // Sort: unread first, then by last message date, admins shown first in ties
  const sorted = [...contactsWithMeta].sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    if (!a.lastMessage && !b.lastMessage) {
      // admins first when no messages
      if (a.user.role === "ADMIN" && b.user.role !== "ADMIN") return -1;
      if (b.user.role === "ADMIN" && a.user.role !== "ADMIN") return 1;
      return 0;
    }
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="chat-layout">
      {/* ── Contact list ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">
            Messages
            {totalUnread > 0 && (
              <span className="chat-unread-badge">{totalUnread}</span>
            )}
          </h2>
          <p className="chat-sidebar-sub">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="chat-agent-list">
          {sorted.length === 0 && (
            <p className="chat-empty-hint">No contacts found.</p>
          )}
          {sorted.map(({ user, lastMessage, unreadCount }) => (
            <button
              key={user.id}
              className={`chat-agent-item${selectedContact?.id === user.id ? " chat-agent-item-active" : ""}`}
              onClick={() => setSelectedContact(user)}
            >
              <div className="chat-agent-avatar">
                {user.profilePicture
                  ? <img src={user.profilePicture} alt={user.name ?? ""} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : getInitials(user.name)}
              </div>
              <div className="chat-agent-info">
                <div className="chat-agent-name">
                  {user.name || "Unknown"}
                  {user.role === "ADMIN" && (
                    <span className="chat-role-badge">Admin</span>
                  )}
                  {unreadCount > 0 && (
                    <span className="chat-unread-dot">{unreadCount}</span>
                  )}
                </div>
                {lastMessage ? (
                  <div className="chat-agent-preview">
                    {lastMessage.fromUserId === agentId ? "You: " : ""}
                    {lastMessage.content.length > 40
                      ? lastMessage.content.slice(0, 40) + "…"
                      : lastMessage.content}
                  </div>
                ) : (
                  <div className="chat-agent-preview chat-agent-preview-empty">No messages yet</div>
                )}
              </div>
              {lastMessage && (
                <div className="chat-agent-time">
                  {formatTime(lastMessage.createdAt)}
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ── Conversation pane ── */}
      <div className="chat-pane">
        {!selectedContact ? (
          <div className="chat-pane-empty">
            <div className="chat-pane-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <p className="chat-pane-empty-text">Select a contact to start chatting</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="chat-pane-header">
              <div className="chat-pane-header-info">
                <div className="chat-pane-avatar">
                  {selectedContact.profilePicture
                    ? <img src={selectedContact.profilePicture} alt={selectedContact.name ?? ""} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : getInitials(selectedContact.name)}
                </div>
                <div>
                  <div className="chat-pane-name">
                    {selectedContact.name || "Unknown"}
                    {selectedContact.role === "ADMIN" && (
                      <span className="chat-role-badge" style={{ marginLeft: "0.5rem" }}>Admin</span>
                    )}
                  </div>
                  <div className="chat-pane-email">{selectedContact.email}</div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {loadingMessages && messages.length === 0 && (
                <p className="chat-loading">Loading messages…</p>
              )}
              {!loadingMessages && messages.length === 0 && (
                <p className="chat-no-messages">No messages yet. Start the conversation!</p>
              )}
              {messages.map((msg) => {
                const isMe = msg.fromUserId === agentId;
                return (
                  <div key={msg.id} className={`chat-bubble-row${isMe ? " chat-bubble-row-me" : ""}`}>
                    <div className={`chat-bubble${isMe ? " chat-bubble-me" : " chat-bubble-them"}`}>
                      <p className="chat-bubble-text">{msg.content}</p>
                      <span className="chat-bubble-time">{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form className="chat-input-bar" onSubmit={sendMessage}>
              <input
                className="input chat-input"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Message ${selectedContact.name || "contact"}…`}
                autoComplete="off"
                disabled={sending}
              />
              <button
                className="btn btn-primary chat-send-btn"
                type="submit"
                disabled={sending || !messageInput.trim()}
              >
                {sending ? "…" : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
