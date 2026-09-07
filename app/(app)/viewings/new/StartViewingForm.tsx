"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, KeyRound } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatGBP } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { startViewingAction } from "../actions";

/**
 * Book the first viewing on a property. The tenant is either one already on
 * the agent's list or registered inline, because refusing to proceed without
 * leaving the screen would lose the momentum of a live enquiry.
 */
export default function StartViewingForm({
  property,
  rooms,
  tenants,
}: {
  property: {
    id: string;
    reference: string;
    address: string;
    propertyType: "FULL" | "SHARED";
  };
  rooms: {
    id: string;
    name: string;
    status: string;
    rentPerMonthPence: number;
    availabilityDate: string | null;
  }[];
  tenants: { id: string; name: string; area: string | null; maxBudgetPence: number | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"existing" | "new">(tenants.length > 0 ? "existing" : "new");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [roomId, setRoomId] = useState(
    rooms.find((room) => room.status === "AVAILABLE")?.id ?? "",
  );
  const [scheduledFor, setScheduledFor] = useState(defaultViewingDateTime());
  const [notes, setNotes] = useState("");

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newRequirements, setNewRequirements] = useState("");

  const isShared = property.propertyType === "SHARED";
  const availableRooms = rooms.filter((room) => room.status !== "LET");

  function submit() {
    setError(null);

    if (isShared && !roomId) {
      setError("Choose which room the viewing is for.");
      return;
    }

    startTransition(async () => {
      const result = await startViewingAction({
        propertyId: property.id,
        roomId: isShared ? roomId : null,
        tenantId: mode === "existing" ? tenantId : undefined,
        newTenant:
          mode === "new"
            ? {
                name: newName,
                phone: newPhone,
                email: newEmail || null,
                area: newArea || null,
                requirements: newRequirements || null,
              }
            : null,
        scheduledFor,
        notes: notes || null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Viewing scheduled. The deal is now in the pipeline.");
      router.push(`/properties/${property.id}?tab=pipeline`);
    });
  }

  return (
    <div className="stack">
      {error && (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <span className="card-title">{property.address}</span>
          <span className="subtle small">{property.reference}</span>
        </div>

        <div className="card-body stack">
          {isShared && (
            <div className="field">
              <label className="field-label" htmlFor="viewing-room">
                Room<span className="required">*</span>
              </label>
              <select
                id="viewing-room"
                className="select"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
              >
                <option value="">Choose a room</option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id} disabled={room.status === "LET"}>
                    {room.name} - {formatGBP(room.rentPerMonthPence)} pcm
                    {room.availabilityDate
                      ? ` (from ${formatDateOnly(room.availabilityDate)})`
                      : ""}
                    {room.status !== "AVAILABLE" ? ` - ${room.status.toLowerCase()}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="viewing-when">
              Date and time<span className="required">*</span>
            </label>
            <input
              id="viewing-when"
              type="datetime-local"
              className="input"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </div>

          <div className="field">
            <span className="field-label">Tenant</span>
            <div className="segmented" role="group" aria-label="Tenant source">
              <button
                type="button"
                aria-pressed={mode === "existing"}
                disabled={tenants.length === 0}
                onClick={() => setMode("existing")}
              >
                Existing tenant
              </button>
              <button type="button" aria-pressed={mode === "new"} onClick={() => setMode("new")}>
                Add new tenant
              </button>
            </div>
          </div>

          {mode === "existing" ? (
            <div className="field">
              <label className="field-label" htmlFor="viewing-tenant">
                Select tenant<span className="required">*</span>
              </label>
              <select
                id="viewing-tenant"
                className="select"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                    {tenant.area ? ` - ${tenant.area}` : ""}
                    {tenant.maxBudgetPence
                      ? ` (up to ${formatGBP(tenant.maxBudgetPence)})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="form-grid">
              <div className="field">
                <label className="field-label" htmlFor="new-tenant-name">
                  Name<span className="required">*</span>
                </label>
                <input
                  id="new-tenant-name"
                  className="input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="new-tenant-phone">
                  Phone number<span className="required">*</span>
                </label>
                <input
                  id="new-tenant-phone"
                  className="input numeric"
                  inputMode="tel"
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="new-tenant-email">
                  Email
                </label>
                <input
                  id="new-tenant-email"
                  type="email"
                  className="input"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="new-tenant-area">
                  Area
                </label>
                <input
                  id="new-tenant-area"
                  className="input"
                  value={newArea}
                  onChange={(event) => setNewArea(event.target.value)}
                />
              </div>

              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label className="field-label" htmlFor="new-tenant-requirements">
                  Requirements
                </label>
                <textarea
                  id="new-tenant-requirements"
                  className="textarea"
                  rows={2}
                  value={newRequirements}
                  onChange={(event) => setNewRequirements(event.target.value)}
                />
              </div>
            </div>
          )}

          <div className="field">
            <label className="field-label" htmlFor="viewing-notes">
              Notes
            </label>
            <textarea
              id="viewing-notes"
              className="textarea"
              rows={3}
              value={notes}
              placeholder="Anything the person showing the property should know."
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>

        <div className="card-footer">
          <div className="form-actions" style={{ width: "100%" }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => router.back()}
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
                !scheduledFor ||
                (mode === "existing" ? !tenantId : !newName.trim() || !newPhone.trim())
              }
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              <KeyRound size={15} />
              Schedule viewing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tomorrow at 17:00, the most common viewing slot. */
function defaultViewingDateTime(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(17, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
