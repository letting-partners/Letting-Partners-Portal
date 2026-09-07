"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Repeat2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { formatGBP } from "@/lib/money";
import { requestCollaborationAction } from "./actions";

/**
 * Send a cross-sell request to the agent who owns the property.
 *
 * A tenant must be chosen first: the whole point of a collaboration is that
 * one agent brings a specific applicant.
 */
export default function RequestCollaboration({
  property,
  rooms,
  tenants,
}: {
  property: {
    id: string;
    reference: string;
    label: string;
    propertyType: "FULL" | "SHARED";
    agentName: string | null;
  };
  rooms: { id: string; name: string; rentPerMonthPence: number; status: string }[];
  tenants: { id: string; name: string; area: string | null; maxBudgetPence: number | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [roomId, setRoomId] = useState(rooms.find((r) => r.status === "AVAILABLE")?.id ?? "");
  const [message, setMessage] = useState("");

  const isShared = property.propertyType === "SHARED";

  function submit() {
    setError(null);

    if (!tenantId) {
      setError("Choose which of your tenants this is for.");
      return;
    }
    if (isShared && !roomId) {
      setError("Choose which room the request is for.");
      return;
    }

    startTransition(async () => {
      const result = await requestCollaborationAction({
        propertyId: property.id,
        roomId: isShared ? roomId : null,
        tenantId,
        message: message || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success(`Request sent to ${property.agentName ?? "the property agent"}.`);
      setOpen(false);
      setMessage("");
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--primary btn--sm btn--block"
        onClick={() => setOpen(true)}
        disabled={tenants.length === 0}
        title={tenants.length === 0 ? "Register a tenant first" : undefined}
      >
        <Repeat2 size={14} />
        Request
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Send a cross-sell request"
        description={`${property.label} · managed by ${property.agentName ?? "another agent"}`}
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
              disabled={pending || !tenantId}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Send request
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

          <div className="field">
            <label className="field-label" htmlFor={`tenant-${property.id}`}>
              Your tenant<span className="required">*</span>
            </label>
            <select
              id={`tenant-${property.id}`}
              className="select"
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
            >
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                  {tenant.area ? ` - ${tenant.area}` : ""}
                  {tenant.maxBudgetPence ? ` (up to ${formatGBP(tenant.maxBudgetPence)})` : ""}
                </option>
              ))}
            </select>
          </div>

          {isShared && (
            <div className="field">
              <label className="field-label" htmlFor={`room-${property.id}`}>
                Room<span className="required">*</span>
              </label>
              <select
                id={`room-${property.id}`}
                className="select"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              >
                <option value="">Choose a room</option>
                {rooms
                  .filter((room) => room.status === "AVAILABLE")
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name} - {formatGBP(room.rentPerMonthPence)} pcm
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor={`message-${property.id}`}>
              Message
            </label>
            <textarea
              id={`message-${property.id}`}
              className="textarea"
              rows={3}
              value={message}
              placeholder="Why this tenant suits the property, and when they want to move."
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          <p className="subtle small">
            If accepted, the agent commission pool is split between you and the property agent at
            the percentages set by an administrator. The split is frozen when the request is
            accepted.
          </p>
        </div>
      </Modal>
    </>
  );
}
