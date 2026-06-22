"use client";

import { useEffect, useRef, useState, FormEvent } from "react";

type Agent = { id: string; name: string; email: string; profilePicture?: string | null };

type Message = {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  fromUserId: string;
  fromUser: { agentDisplayName: string; role: string };
};

type ConversationMeta = {
  agent: Agent;
  lastMessage: { content: string; createdAt: string; fromUserId: string } | null;
  unreadCount: number;
};

type Props = {
  adminId: string;
  agents: Agent[];
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

export function AdminChatClient({ adminId, agents }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const convPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch conversations list
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

  // Fetch messages for selected agent
  async function fetchMessages(agentId: string) {
    try {
      const res = await fetch(`/api/chat/messages?agentId=${agentId}`);
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

  // When agent selected: load messages + start polling
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedAgent) { setMessages([]); return; }

    setLoadingMessages(true);
    fetchMessages(selectedAgent.id).then(() => setLoadingMessages(false));

    pollRef.current = setInterval(() => {
      fetchMessages(selectedAgent.id);
      fetchConversations();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent?.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!messageInput.trim() || !selectedAgent || sending) return;

    setSending(true);
    const content = messageInput.trim();
    setMessageInput("");

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selectedAgent.id, content }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
      }
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation() {
    if (!selectedAgent || deleting) return;
    if (!confirm(`Delete all messages with ${selectedAgent.name}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await fetch(`/api/chat/conversations/${selectedAgent.id}`, { method: "DELETE" });
      setMessages([]);
      setSelectedAgent(null);
      fetchConversations();
    } finally {
      setDeleting(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) +
      " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  // Merge conversation metadata with agents list (include agents with no messages too)
  const agentsWithMeta: ConversationMeta[] = agents.map((agent) => {
    const found = conversations.find((c) => c.agent.id === agent.id);
    return found ?? { agent, lastMessage: null, unreadCount: 0 };
  });

  // Sort: unread first, then by lastMessage date
  const sorted = [...agentsWithMeta].sort((a, b) => {
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    if (!a.lastMessage && !b.lastMessage) return 0;
    if (!a.lastMessage) return 1;
    if (!b.lastMessage) return -1;
    return new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime();
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <div className="chat-layout">
      {/* ── Agent list ── */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">
            Agent Chats
            {totalUnread > 0 && (
              <span className="chat-unread-badge">{totalUnread}</span>
            )}
          </h2>
          <p className="chat-sidebar-sub">{agents.length} agent{agents.length !== 1 ? "s" : ""}</p>
        </div>

        <div className="chat-agent-list">
          {sorted.length === 0 && (
            <p className="chat-empty-hint">No agents yet.</p>
          )}
          {sorted.map(({ agent, lastMessage, unreadCount }) => (
            <button
              key={agent.id}
              className={`chat-agent-item${selectedAgent?.id === agent.id ? " chat-agent-item-active" : ""}`}
              onClick={() => setSelectedAgent(agent)}
            >
              <div className="chat-agent-avatar">
                {agent.profilePicture
                  ? <img src={agent.profilePicture} alt={agent.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                  : getInitials(agent.name)}
              </div>
              <div className="chat-agent-info">
                <div className="chat-agent-name">
                  {agent.name}
                  {unreadCount > 0 && (
                    <span className="chat-unread-dot">{unreadCount}</span>
                  )}
                </div>
                {lastMessage ? (
                  <div className="chat-agent-preview">
                    {lastMessage.fromUserId === adminId ? "You: " : ""}
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
        {!selectedAgent ? (
          <div className="chat-pane-empty">
            <div className="chat-pane-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <p className="chat-pane-empty-text">Select an agent to view their conversation</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="chat-pane-header">
              <div className="chat-pane-header-info">
                <div className="chat-pane-avatar">
                  {selectedAgent.profilePicture
                    ? <img src={selectedAgent.profilePicture} alt={selectedAgent.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                    : getInitials(selectedAgent.name)}
                </div>
                <div>
                  <div className="chat-pane-name">{selectedAgent.name}</div>
                  <div className="chat-pane-email">{selectedAgent.email}</div>
                </div>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={deleteConversation}
                disabled={deleting || messages.length === 0}
                title="Delete all messages in this conversation"
              >
                {deleting ? "Deleting…" : "Delete Conversation"}
              </button>
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
                const isMe = msg.fromUserId === adminId;
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
                placeholder={`Message ${selectedAgent.name}…`}
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
