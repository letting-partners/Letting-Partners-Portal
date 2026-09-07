"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { createUserAction } from "./actions";

/**
 * Create a staff account.
 *
 * There is no password: creating the account is what grants access, because
 * the new address can immediately request a sign-in code.
 */
export default function UserForm({
  agents,
  defaultRole = "FRONTER",
  label = "Add user",
}: {
  agents: { id: string; fullName: string }[];
  defaultRole?: "SUPER_ADMIN" | "AGENT" | "FRONTER";
  label?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState(defaultRole);
  const [jobTitle, setJobTitle] = useState("");
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [commissionType, setCommissionType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [commissionValue, setCommissionValue] = useState("");

  function submit() {
    setError(null);

    startTransition(async () => {
      const result = await createUserAction({
        fullName,
        email,
        phone: phone || null,
        role,
        jobTitle: jobTitle || null,
        assignedAgentId: role === "FRONTER" ? agentId : null,
        commissionType: commissionValue ? commissionType : null,
        commissionValue: commissionValue ? Math.round(Number(commissionValue) * 100) : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(`${fullName} can now sign in with ${email}.`);
      setOpen(false);
      setFullName("");
      setEmail("");
      setPhone("");
      setJobTitle("");
      setCommissionValue("");
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
        <UserPlus size={15} />
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a staff account"
        description="They will be emailed to say the account is ready. There is no password to set."
        wide
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={
                pending ||
                !fullName.trim() ||
                !email.trim() ||
                (role === "FRONTER" && !agentId)
              }
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Create account
            </button>
          </>
        }
      >
        <div className="stack">
          {error && (
            <div className="alert alert--danger" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="user-name">
                Full name<span className="required">*</span>
              </label>
              <input
                id="user-name"
                className="input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="user-email">
                Email address<span className="required">*</span>
              </label>
              <input
                id="user-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <span className="field-hint">This is how they sign in.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="user-role">
                Role<span className="required">*</span>
              </label>
              <select
                id="user-role"
                className="select"
                value={role}
                onChange={(event) => setRole(event.target.value as typeof role)}
              >
                <option value="FRONTER">Fronter</option>
                <option value="AGENT">Agent</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </div>

            {role === "FRONTER" && (
              <div className="field">
                <label className="field-label" htmlFor="user-agent">
                  Reports to<span className="required">*</span>
                </label>
                <select
                  id="user-agent"
                  className="select"
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="user-phone">
                Phone
              </label>
              <input
                id="user-phone"
                className="input numeric"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="user-title">
                Job title
              </label>
              <input
                id="user-title"
                className="input"
                value={jobTitle}
                placeholder={role === "FRONTER" ? "Landlord Acquisition" : "Lettings Manager"}
                onChange={(event) => setJobTitle(event.target.value)}
              />
            </div>
          </div>

          <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ marginBottom: 6 }}>
              Commission override
            </legend>
            <div className="row">
              <div className="segmented" role="group" aria-label="Commission type">
                <button
                  type="button"
                  aria-pressed={commissionType === "PERCENTAGE"}
                  onClick={() => setCommissionType("PERCENTAGE")}
                >
                  %
                </button>
                <button
                  type="button"
                  aria-pressed={commissionType === "FIXED"}
                  onClick={() => setCommissionType("FIXED")}
                >
                  £
                </button>
              </div>
              <input
                className="input"
                style={{ maxWidth: 140 }}
                inputMode="decimal"
                value={commissionValue}
                placeholder="Leave blank for default"
                onChange={(event) => setCommissionValue(event.target.value)}
                aria-label="Commission value"
              />
            </div>
            <span className="field-hint">
              Leave blank to use the global default for their role.
            </span>
          </fieldset>
        </div>
      </Modal>
    </>
  );
}
