"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { updateAdminAgentDialerSettings, type AdminAgentDialerSettings } from "@/lib/portal-api";
import { formatDate, formatDateTime } from "@/lib/format";

type Props = {
  initialAgent: AdminAgentDialerSettings;
  dialerMode: "SIP" | "LINKUS";
};

type Message = { type: "success" | "error"; text: string } | null;

export function AdminAgentSettingsClient({ initialAgent, dialerMode }: Props) {
  const [baseline, setBaseline] = useState(initialAgent);
  const [name, setName] = useState(initialAgent.agentDisplayName);
  const [email, setEmail] = useState(initialAgent.email);
  const [isActive, setIsActive] = useState(initialAgent.isActive);
  const [newPassword, setNewPassword] = useState("");

  const [providerUsername, setProviderUsername] = useState(initialAgent.dialer.providerUsername ?? "");
  const [providerPassword, setProviderPassword] = useState("");
  const [clearProviderPassword, setClearProviderPassword] = useState(false);
  const [extensionNumber, setExtensionNumber] = useState(initialAgent.dialer.extensionNumber ?? "");
  const [extensionName, setExtensionName] = useState(initialAgent.dialer.extensionName ?? "");
  const [autoDetectExtension, setAutoDetectExtension] = useState(initialAgent.dialer.autoDetectExtension);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [hasProviderPassword, setHasProviderPassword] = useState(initialAgent.dialer.hasProviderPassword);
  const [dialerUpdatedAt, setDialerUpdatedAt] = useState(initialAgent.dialer.updatedAt);
  const isSipMode = dialerMode === "SIP";

  const hasUnsavedChanges = useMemo(() => {
    return (
      name.trim() !== baseline.agentDisplayName ||
      email.trim().toLowerCase() !== baseline.email.toLowerCase() ||
      isActive !== baseline.isActive ||
      newPassword.length > 0 ||
      (isSipMode && providerUsername.trim() !== (baseline.dialer.providerUsername ?? "")) ||
      (isSipMode && providerPassword.length > 0) ||
      (isSipMode && clearProviderPassword) ||
      extensionNumber.trim() !== (baseline.dialer.extensionNumber ?? "") ||
      extensionName.trim() !== (baseline.dialer.extensionName ?? "") ||
      autoDetectExtension !== baseline.dialer.autoDetectExtension
    );
  }, [
    autoDetectExtension,
    baseline.agentDisplayName,
    baseline.dialer.autoDetectExtension,
    baseline.dialer.extensionName,
    baseline.dialer.extensionNumber,
    baseline.dialer.providerUsername,
    baseline.email,
    baseline.isActive,
    clearProviderPassword,
    email,
    extensionName,
    extensionNumber,
    isActive,
    isSipMode,
    name,
    newPassword,
    providerPassword,
    providerUsername,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload: Parameters<typeof updateAdminAgentDialerSettings>[1] = {
      email: email.trim(),
      agentDisplayName: name.trim(),
      isActive,
      extensionNumber: extensionNumber.trim() || null,
      extensionName: extensionName.trim() || null,
      autoDetectExtension,
    };
    if (isSipMode) {
      payload.providerUsername = providerUsername.trim() || null;
    }

    if (newPassword.trim().length > 0) {
      payload.newPassword = newPassword;
    }
    if (isSipMode) {
      if (providerPassword.trim().length > 0) {
        payload.providerPassword = providerPassword;
      } else if (clearProviderPassword) {
        payload.providerPassword = null;
      }
    }

    const result = await updateAdminAgentDialerSettings(initialAgent.id, payload);
    setSaving(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to save agent settings." });
      return;
    }

    setMessage({ type: "success", text: result.data.message });
    setNewPassword("");
    setProviderPassword("");
    setClearProviderPassword(false);
    setName(result.data.agent.agentDisplayName);
    setEmail(result.data.agent.email);
    setIsActive(result.data.agent.isActive);
    setProviderUsername(result.data.agent.dialer.providerUsername ?? "");
    setExtensionNumber(result.data.agent.dialer.extensionNumber ?? "");
    setExtensionName(result.data.agent.dialer.extensionName ?? "");
    setAutoDetectExtension(result.data.agent.dialer.autoDetectExtension);
    setHasProviderPassword(result.data.agent.dialer.hasProviderPassword);
    setDialerUpdatedAt(result.data.agent.dialer.updatedAt);
    setBaseline(result.data.agent);
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <Link
            href="/admin/agents"
            style={{ display: "inline-block", marginBottom: "0.35rem", color: "var(--text-muted)", fontSize: "0.82rem" }}
          >
            {"<-"} Back to Agents
          </Link>
          <h1 className="page-title">Agent Settings</h1>
          <p className="page-subtitle">
            {name || "Agent"} ({email || "-"}) | Joined {formatDate(initialAgent.createdAt)}
          </p>
        </div>
        <span className={`badge ${isActive ? "badge-active" : "badge-locked"}`}>
          {isActive ? "Active" : "Disabled"}
        </span>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <form className="stack" onSubmit={handleSubmit}>
        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 9a7 7 0 1 1 14 0H3Z" clipRule="evenodd" />
              </svg>
              Account Profile
            </h2>
          </div>
          <div className="admin-card-body">
            <div className="field-grid" style={{ maxWidth: 680 }}>
              <div className="two-col">
                <label className="field">
                  <span className="label">Agent Name</span>
                  <UIInput value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <UIInput
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="off"
                  />
                </label>
              </div>

              <div className="two-col">
                <label className="field">
                  <span className="label">New Password (Optional)</span>
                  <UIInput
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Leave blank to keep current password"
                    autoComplete="new-password"
                  />
                </label>
                <label className="inline-row" style={{ alignItems: "center", paddingTop: "1.8rem" }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  <span style={{ color: "var(--text)", fontSize: "0.88rem" }}>
                    Agent account is active
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="admin-card-header">
            <h2 className="admin-card-title">
              <svg viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 4.75A2.75 2.75 0 0 1 4.75 2h2.5A2.75 2.75 0 0 1 10 4.75v10.5A2.75 2.75 0 0 1 7.25 18h-2.5A2.75 2.75 0 0 1 2 15.25V4.75Zm10 0A2.75 2.75 0 0 1 14.75 2h.5A2.75 2.75 0 0 1 18 4.75v3.5a.75.75 0 0 1-1.5 0v-3.5c0-.69-.56-1.25-1.25-1.25h-.5c-.69 0-1.25.56-1.25 1.25v10.5c0 .69.56 1.25 1.25 1.25h.5c.69 0 1.25-.56 1.25-1.25v-3.5a.75.75 0 0 1 1.5 0v3.5A2.75 2.75 0 0 1 15.25 18h-.5A2.75 2.75 0 0 1 12 15.25V4.75Z" />
              </svg>
              Dialer Extension Settings
            </h2>
            <div className="inline-row">
              <span className={`badge ${isSipMode ? "badge-active" : "badge-warning"}`}>
                {isSipMode ? "SIP Mode" : "Linkus Mode"}
              </span>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Last updated: {dialerUpdatedAt ? formatDateTime(dialerUpdatedAt) : "Never"}
              </span>
            </div>
          </div>
          <div className="admin-card-body">
            <div className="field-grid" style={{ maxWidth: 760 }}>
              {isSipMode ? (
                <>
                  <div className="two-col">
                    <label className="field">
                      <span className="label">Provider Username</span>
                      <UIInput
                        value={providerUsername}
                        onChange={(event) => setProviderUsername(event.target.value)}
                        placeholder="Extension SIP username"
                        autoComplete="off"
                      />
                    </label>
                    <label className="field">
                      <span className="label">Provider Password</span>
                      <UIInput
                        type="password"
                        value={providerPassword}
                        onChange={(event) => {
                          setProviderPassword(event.target.value);
                          if (event.target.value.length > 0) setClearProviderPassword(false);
                        }}
                        placeholder={hasProviderPassword ? "Saved (enter to replace)" : "Set extension password"}
                        autoComplete="new-password"
                      />
                    </label>
                  </div>

                  <label className="inline-row" style={{ alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={clearProviderPassword}
                      onChange={(event) => setClearProviderPassword(event.target.checked)}
                      disabled={providerPassword.length > 0 || !hasProviderPassword}
                    />
                    <span style={{ fontSize: "0.83rem", color: "var(--text-muted)" }}>
                      Clear saved provider password
                    </span>
                  </label>
                </>
              ) : (
                <p className="hint-text" style={{ marginTop: 0 }}>
                  Linkus mode is active. Provider SIP username/password are managed in the provider app.
                </p>
              )}

              <div className="two-col">
                <label className="field">
                  <span className="label">Extension Number</span>
                  <UIInput
                    value={extensionNumber}
                    onChange={(event) => setExtensionNumber(event.target.value)}
                    placeholder={autoDetectExtension ? "Auto-detected by provider" : "e.g. 101"}
                    disabled={autoDetectExtension}
                    autoComplete="off"
                  />
                </label>
                <label className="field">
                  <span className="label">Extension Display Name</span>
                  <UIInput
                    value={extensionName}
                    onChange={(event) => setExtensionName(event.target.value)}
                    placeholder="Name shown in dialer"
                    autoComplete="off"
                  />
                </label>
              </div>

              <label className="inline-row" style={{ alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={autoDetectExtension}
                  onChange={(event) => setAutoDetectExtension(event.target.checked)}
                />
                <span style={{ fontSize: "0.88rem", color: "var(--text)" }}>
                  Auto-detect extension number from provider account
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="inline-row">
          <UIButton type="submit" disabled={saving || !hasUnsavedChanges}>
            {saving ? "Saving..." : "Save Agent Settings"}
          </UIButton>
          <Link href={`/admin/agents/${initialAgent.id}`} className="btn btn-secondary">
            View Agent Overview
          </Link>
        </div>
      </form>
    </div>
  );
}
