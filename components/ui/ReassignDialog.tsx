"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCog } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/**
 * Move a record to a different agent, or a different originating fronter.
 *
 * One dialog for landlords, properties and tenants, because it is the same
 * decision in each case and the reason it asks for is the same too. Ownership
 * decides who can see a record and who is credited on a cross sell, so a
 * reassignment is a deliberate act with a written reason rather than an edit.
 *
 * Commission already calculated against a closed deal is untouched: those
 * figures were snapshotted when the deal closed and belong to whoever earned
 * them. This changes who works the record from here.
 */

export type AssignablePerson = { id: string; fullName: string };

export default function ReassignDialog({
  open,
  onClose,
  label,
  agents,
  fronters,
  currentAgentId,
  currentFronterId,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** What is being moved, named in the heading. */
  label: string;
  agents: AssignablePerson[];
  /** Omitted for records with no fronter, such as a tenant. */
  fronters?: AssignablePerson[];
  currentAgentId?: string | null;
  currentFronterId?: string | null;
  onSubmit: (next: { agentId: string | null; fronterId: string | null }, reason: string) =>
    Promise<{ ok: boolean; error?: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [agentId, setAgentId] = useState(currentAgentId ?? "");
  const [fronterId, setFronterId] = useState(currentFronterId ?? "");
  const [reason, setReason] = useState("");

  const unchanged =
    (agentId || null) === (currentAgentId ?? null) &&
    (fronterId || null) === (currentFronterId ?? null);

  function submit() {
    startTransition(async () => {
      const result = await onSubmit(
        { agentId: agentId || null, fronterId: fronterId || null },
        reason,
      );

      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong.");
        return;
      }

      toast.success("Reassigned.");
      setReason("");
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      title={`Reassign ${label}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}
            disabled={pending || !reason.trim() || unchanged}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            <UserCog size={15} />
            Reassign
          </button>
        </>
      }
    >
      <div className="stack--sm stack">
        <div className="field">
          <label className="field-label" htmlFor="reassign-agent">
            Agent
          </label>
          <select
            id="reassign-agent"
            className="select"
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.fullName}
              </option>
            ))}
          </select>
        </div>

        {fronters && (
          <div className="field">
            <label className="field-label" htmlFor="reassign-fronter">
              Originating fronter
            </label>
            <select
              id="reassign-fronter"
              className="select"
              value={fronterId}
              onChange={(event) => setFronterId(event.target.value)}
            >
              <option value="">None</option>
              {fronters.map((fronter) => (
                <option key={fronter.id} value={fronter.id}>
                  {fronter.fullName}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Who won this originally. It decides who is credited, so change it only to correct a
              mistake.
            </span>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="reassign-reason">
            Reason<span className="required">*</span>
          </label>
          <textarea
            id="reassign-reason"
            className="input"
            rows={2}
            placeholder="Agent left, workload balancing, credited to the wrong person..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="field-hint">Recorded against the record permanently.</span>
        </div>
      </div>
    </Modal>
  );
}
