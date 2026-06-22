"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { apiPatch, apiPost } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import { listAgents } from "@/lib/portal-api";

type AgentRow = {
  id: string;
  email: string;
  agentDisplayName: string;
  profilePicture?: string | null;
  isActive: boolean;
  createdAt: string;
  ownedLandlords: number;
  ownedProperties: number;
  closedSales: number;
  tenants: number;
};

type CreateMode = "TEMP_PASSWORD" | "AUTO_GENERATE";

type CreateFormState = {
  email: string;
  agentDisplayName: string;
  mode: CreateMode;
  tempPassword: string;
};

type Props = {
  initialAgents: AgentRow[];
};

function validate(form: CreateFormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const email = form.email.trim();
  if (!email) errors.email = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Enter a valid email.";
  if (!form.agentDisplayName.trim())
    errors.agentDisplayName = "Agent name is required.";
  if (form.mode === "TEMP_PASSWORD") {
    if (!form.tempPassword)
      errors.tempPassword = "Temporary password is required.";
    else if (form.tempPassword.length < 8)
      errors.tempPassword = "Minimum 8 characters.";
  }
  return errors;
}

function AgentInitials({ name, email, profilePicture }: { name: string; email: string; profilePicture?: string | null }) {
  const src = name || email;
  const chars = src
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: "50%",
        background: "var(--brand-gold-light)",
        border: "1px solid var(--border-gold)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "var(--brand-gold)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {profilePicture
        ? <img src={profilePicture} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : chars}
    </div>
  );
}

export function AgentsAdminClient({ initialAgents }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>(initialAgents);
  const [search, setSearch] = useState("");
  const [includeDisabled, setIncludeDisabled] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [workingAgentId, setWorkingAgentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<CreateFormState>({
    email: "",
    agentDisplayName: "",
    mode: "TEMP_PASSWORD",
    tempPassword: "",
  });

  // Kebab menu + reset password modal state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [resetPwFor, setResetPwFor] = useState<AgentRow | null>(null);
  const [newPw, setNewPw] = useState("");
  const [newPwError, setNewPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Delete agent state
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<AgentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  const shownCount = useMemo(() => agents.length, [agents.length]);

  async function fetchAgents() {
    setLoadingAgents(true);
    setMessage(null);
    const result = await listAgents({
      search: search.trim() || undefined,
      includeDisabled,
    });
    setLoadingAgents(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load agents." });
      return;
    }
    const mapped: AgentRow[] = (result.data.agents ?? []).map((a) => ({
      id: a.id,
      email: a.email,
      agentDisplayName: a.agentDisplayName,
      profilePicture: a.profilePicture,
      isActive: a.isActive,
      createdAt: new Date(a.createdAt).toISOString(),
      ownedLandlords: a._count?.ownedLandlords ?? 0,
      ownedProperties: a._count?.ownedProperties ?? 0,
      closedSales: 0,
      tenants: 0,
    }));
    setAgents(mapped);
  }

  async function handleCreateAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCreating(true);
    const result = await apiPost<
      { email: string; agentDisplayName: string; mode: CreateMode; tempPassword?: string },
      { message: string; generatedTempPassword?: string }
    >("/api/admin/users", {
      email: form.email.trim(),
      agentDisplayName: form.agentDisplayName.trim(),
      mode: form.mode,
      tempPassword: form.mode === "TEMP_PASSWORD" ? form.tempPassword : undefined,
    });
    setCreating(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to create agent." });
      return;
    }

    const successText = result.data.generatedTempPassword
      ? `${result.data.message} Temporary password: ${result.data.generatedTempPassword}`
      : result.data.message;

    setMessage({ type: "success", text: successText });
    setForm({ email: "", agentDisplayName: "", mode: "TEMP_PASSWORD", tempPassword: "" });
    setFieldErrors({});
    setShowForm(false);
    await fetchAgents();
  }

  async function toggleAgentStatus(agent: AgentRow) {
    setWorkingAgentId(agent.id);
    setMessage(null);
    const result = await apiPatch<
      { isActive: boolean },
      { message: string; agent: { isActive: boolean } }
    >(`/api/admin/users/${agent.id}`, { isActive: !agent.isActive });
    setWorkingAgentId(null);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update." });
      return;
    }
    setAgents((prev) =>
      prev.map((item) =>
        item.id === agent.id ? { ...item, isActive: result.data.agent.isActive } : item
      )
    );
    setMessage({ type: "success", text: result.data.message });
  }

  async function setAgentPassword(agent: AgentRow, newPassword: string): Promise<boolean> {
    setWorkingAgentId(agent.id);
    setMessage(null);
    const result = await apiPatch<
      { newPassword: string },
      { message: string }
    >(`/api/admin/users/${agent.id}`, { newPassword });
    setWorkingAgentId(null);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to reset password." });
      return false;
    }
    setMessage({ type: "success", text: result.data.message });
    return true;
  }

  async function handlePasswordReset(e: FormEvent) {
    e.preventDefault();
    if (!resetPwFor) return;
    if (newPw.length < 8) {
      setNewPwError("Minimum 8 characters.");
      return;
    }
    setNewPwError("");
    setSavingPw(true);
    const ok = await setAgentPassword(resetPwFor, newPw);
    setSavingPw(false);
    if (ok) {
      setResetPwFor(null);
      setNewPw("");
    }
  }

  function openResetPwModal(agent: AgentRow) {
    setMenuOpenId(null);
    setResetPwFor(agent);
    setNewPw("");
    setNewPwError("");
  }

  async function handleDeleteAgent() {
    if (!deleteConfirmFor) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteConfirmFor.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: json.message ?? "Failed to delete agent." });
      } else {
        setMessage({ type: "success", text: json.message ?? "Agent deleted." });
        setAgents((prev) => prev.filter((a) => a.id !== deleteConfirmFor.id));
      }
    } catch {
      setMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setDeleting(false);
      setDeleteConfirmFor(null);
    }
  }

  return (
    <div className="stack">
      {/* Page Header */}
      <header className="page-header">
        <div>
          <h1 className="page-title">Agent Management</h1>
          <p className="page-subtitle">
            Create, enable/disable, and manage agent accounts.
          </p>
        </div>
        <button
          className="admin-action-btn admin-action-btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
          {showForm ? "Cancel" : "Add Agent"}
        </button>
      </header>

      {/* Notification */}
      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      {/* Create Agent Form (collapsible) */}
      {showForm && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              New Agent
            </h2>
          </div>
          <div className="admin-card-body">
            <form className="field-grid" onSubmit={handleCreateAgent} style={{ maxWidth: 540 }}>
              <div className="two-col">
                <label className="field">
                  <span className="label">Email Address</span>
                  <UIInput
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="agent@example.com"
                  />
                  {fieldErrors.email && (
                    <span className="error-text">{fieldErrors.email}</span>
                  )}
                </label>
                <label className="field">
                  <span className="label">Display Name</span>
                  <UIInput
                    value={form.agentDisplayName}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, agentDisplayName: e.target.value }))
                    }
                    placeholder="James Wilson"
                  />
                  {fieldErrors.agentDisplayName && (
                    <span className="error-text">{fieldErrors.agentDisplayName}</span>
                  )}
                </label>
              </div>

              <label className="field">
                <span className="label">Password Setup</span>
                <UISelect
                  value={form.mode}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      mode: e.target.value as CreateMode,
                      tempPassword: e.target.value === "TEMP_PASSWORD" ? p.tempPassword : "",
                    }))
                  }
                >
                  <option value="TEMP_PASSWORD">Set a temporary password</option>
                  <option value="AUTO_GENERATE">Auto-generate password</option>
                </UISelect>
              </label>

              {form.mode === "TEMP_PASSWORD" && (
                <label className="field">
                  <span className="label">Temporary Password</span>
                  <UIInput
                    type="password"
                    value={form.tempPassword}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, tempPassword: e.target.value }))
                    }
                    placeholder="Min. 8 characters"
                  />
                  {fieldErrors.tempPassword && (
                    <span className="error-text">{fieldErrors.tempPassword}</span>
                  )}
                </label>
              )}

              <div className="inline-row">
                <UIButton type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create Agent"}
                </UIButton>
                <UIButton
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setFieldErrors({});
                    setForm({ email: "", agentDisplayName: "", mode: "TEMP_PASSWORD", tempPassword: "" });
                  }}
                >
                  Cancel
                </UIButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent List */}
      <div className="admin-card">
        <div className="admin-card-header">
          <h2 className="admin-card-title">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
            </svg>
            All Agents
            <span
              style={{
                fontSize: "0.72rem",
                background: "var(--brand-gold-light)",
                color: "var(--brand-gold)",
                padding: "0.1rem 0.45rem",
                borderRadius: 99,
                fontWeight: 700,
                border: "1px solid var(--border-gold)",
              }}
            >
              {shownCount}
            </span>
          </h2>

          <div className="inline-row">
            <UIInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents…"
              style={{ minWidth: 200 }}
            />
            <label className="inline-row" style={{ cursor: "pointer", gap: "0.4rem" }}>
              <input
                type="checkbox"
                checked={includeDisabled}
                onChange={(e) => setIncludeDisabled(e.target.checked)}
              />
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Show disabled
              </span>
            </label>
            <UIButton
              variant="secondary"
              onClick={() => void fetchAgents()}
              disabled={loadingAgents}
            >
              {loadingAgents ? "Loading…" : "Refresh"}
            </UIButton>
          </div>
        </div>

        <div style={{ padding: 0 }}>
          {agents.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <p className="muted">No agents found.</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Landlords</th>
                    <th>Properties</th>
                    <th>Sales</th>
                    <th>Tenants</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((agent) => {
                    const busy = workingAgentId === agent.id;
                    return (
                      <tr key={agent.id}>
                        <td>
                          <Link
                            href={`/admin/agents/${agent.id}`}
                            style={{ display: "flex", alignItems: "center", gap: "0.6rem", textDecoration: "none", color: "inherit" }}
                          >
                            <AgentInitials
                              name={agent.agentDisplayName}
                              email={agent.email}
                              profilePicture={agent.profilePicture}
                            />
                            <div>
                              <strong style={{ color: "var(--brand-gold)" }}>{agent.agentDisplayName}</strong>
                              <span
                                className="muted"
                                style={{ display: "block", fontSize: "0.78rem" }}
                              >
                                {agent.email}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <span
                            className={`badge ${agent.isActive ? "badge-active" : "badge-locked"}`}
                          >
                            {agent.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="gold" style={{ fontWeight: 700 }}>
                          {agent.ownedLandlords}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {agent.ownedProperties}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: agent.closedSales > 0 ? "#4ade80" : "var(--text-subtle)" }}>
                            {agent.closedSales}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: agent.tenants > 0 ? "var(--brand-gold)" : "var(--text-subtle)" }}>
                            {agent.tenants}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                          {formatDate(agent.createdAt)}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                            <Link
                              href={`/admin/agents/${agent.id}/settings`}
                              className="kebab-btn"
                              aria-label={`Open ${agent.agentDisplayName} settings`}
                              title="Agent settings"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                <path fillRule="evenodd" d="M11.49 3.17a1 1 0 0 0-1.98 0l-.06.31a1 1 0 0 1-.75.77l-.31.08a1 1 0 0 0-.3 1.81l.27.2c.26.2.37.54.29.86l-.09.3a1 1 0 0 0 1.42 1.14l.28-.15a1 1 0 0 1 .94 0l.28.15a1 1 0 0 0 1.42-1.14l-.09-.3a1 1 0 0 1 .29-.86l.27-.2a1 1 0 0 0-.3-1.81l-.31-.08a1 1 0 0 1-.75-.77l-.06-.31ZM10 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                                <path d="M4 12.25A2.25 2.25 0 0 1 6.25 10h7.5A2.25 2.25 0 0 1 16 12.25v2.5A2.25 2.25 0 0 1 13.75 17h-7.5A2.25 2.25 0 0 1 4 14.75v-2.5Zm2.25-.75a.75.75 0 0 0-.75.75v2.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75v-2.5a.75.75 0 0 0-.75-.75h-7.5Z" />
                              </svg>
                            </Link>

                            <div style={{ position: "relative" }} ref={menuOpenId === agent.id ? menuRef : undefined}>
                            <button
                              className="kebab-btn"
                              aria-label="Agent actions"
                              onClick={() => setMenuOpenId(menuOpenId === agent.id ? null : agent.id)}
                              disabled={busy}
                            >
                              {busy ? (
                                <span style={{ fontWeight: 700, letterSpacing: 1 }}>…</span>
                              ) : (
                                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                                  <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
                                </svg>
                              )}
                            </button>
                            {menuOpenId === agent.id && (
                              <div className="kebab-menu">
                                <button
                                  className="kebab-menu-item"
                                  onClick={() => openResetPwModal(agent)}
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                    <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L8.196 8.39A5.002 5.002 0 0 1 8 7Zm5-3a.75.75 0 0 0 0 1.5A1.5 1.5 0 1 1 11.5 7a.75.75 0 0 0-1.5 0 3 3 0 1 0 3-3Z" clipRule="evenodd" />
                                  </svg>
                                  Reset Password
                                </button>
                                <Link
                                  href={`/admin/agents/${agent.id}#reassignment-tools`}
                                  className="kebab-menu-item"
                                  onClick={() => setMenuOpenId(null)}
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                    <path d="M3.5 4.75A2.25 2.25 0 0 1 5.75 2.5h6.69a2.25 2.25 0 0 1 1.59.66l1.81 1.81a2.25 2.25 0 0 1 .66 1.59v7.69a2.25 2.25 0 0 1-2.25 2.25H5.75A2.25 2.25 0 0 1 3.5 14.25V4.75Zm2.25-.75a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75V7.06a.75.75 0 0 0-.22-.53l-1.81-1.81a.75.75 0 0 0-.53-.22H5.75Z" />
                                    <path d="M10.75 6.25a.75.75 0 0 0-1.5 0v2h-2a.75.75 0 0 0 0 1.5h2v2a.75.75 0 0 0 1.5 0v-2h2a.75.75 0 0 0 0-1.5h-2v-2Z" />
                                  </svg>
                                  Reassign Records
                                </Link>
                                <div className="kebab-menu-divider" />
                                <button
                                  className={`kebab-menu-item${agent.isActive ? " kebab-menu-item-danger" : ""}`}
                                  onClick={() => { setMenuOpenId(null); void toggleAgentStatus(agent); }}
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                    {agent.isActive ? (
                                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                                    ) : (
                                      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                                    )}
                                  </svg>
                                  {agent.isActive ? "Disable Agent" : "Enable Agent"}
                                </button>
                                <div className="kebab-menu-divider" />
                                <button
                                  className="kebab-menu-item kebab-menu-item-danger"
                                  onClick={() => { setMenuOpenId(null); setDeleteConfirmFor(agent); }}
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                                  </svg>
                                  Delete Agent
                                </button>
                              </div>
                            )}
                          </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Agent Confirmation Modal */}
      {deleteConfirmFor && (
        <div
          className="modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteConfirmFor(null); }}
        >
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                Delete Agent
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                This will permanently delete{" "}
                <strong style={{ color: "var(--brand-gold)" }}>{deleteConfirmFor.agentDisplayName}</strong>{" "}
                and all their landlords, properties, and sales.
              </p>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#f87171", fontWeight: 600 }}>
                This action cannot be undone.
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="admin-action-btn"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                onClick={() => setDeleteConfirmFor(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="admin-action-btn"
                style={{ background: "#dc2626", color: "#fff", border: "none" }}
                onClick={() => void handleDeleteAgent()}
                disabled={deleting}
              >
                {deleting ? "Deleting…" : "Delete Agent"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPwFor && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setResetPwFor(null);
              setNewPw("");
              setNewPwError("");
            }
          }}
        >
          <div className="modal-card" style={{ maxWidth: 420 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                Reset Password
              </h3>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Set a new password for <strong style={{ color: "var(--brand-gold)" }}>{resetPwFor.agentDisplayName}</strong>
              </p>
            </div>
            <form onSubmit={handlePasswordReset}>
              <div className="modal-body">
                <label className="field">
                  <span className="label">New Password</span>
                  <UIInput
                    type="password"
                    value={newPw}
                    onChange={(e) => { setNewPw(e.target.value); setNewPwError(""); }}
                    placeholder="Min. 8 characters"
                    autoFocus
                  />
                  {newPwError && <span className="error-text">{newPwError}</span>}
                </label>
              </div>
              <div className="modal-foot">
                <UIButton
                  type="button"
                  variant="secondary"
                  onClick={() => { setResetPwFor(null); setNewPw(""); setNewPwError(""); }}
                >
                  Cancel
                </UIButton>
                <UIButton type="submit" disabled={savingPw || !newPw}>
                  {savingPw ? "Saving…" : "Save Password"}
                </UIButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
