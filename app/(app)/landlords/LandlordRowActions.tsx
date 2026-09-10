"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Eye, Pencil, PhoneForwarded, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  archiveLandlordAction,
  correctLandlordPhoneAction,
  updateLandlordAction,
} from "./actions";

type Gender = "MALE" | "FEMALE" | "PREFER_NOT_TO_SAY" | "OTHER";

/**
 * Per-row actions for the landlords table.
 *
 * Delete is an archive - the row is flagged and attributed rather than removed,
 * because calls, properties and commissions point at it and the history must
 * not develop holes. An admin can restore one.
 */
export default function LandlordRowActions({
  landlord,
  canEdit,
  isAdmin,
}: {
  landlord: {
    id: string;
    name: string;
    email: string | null;
    alternatePhone?: string | null;
    gender?: string | null;
    propertyCount: number;
    phone?: string | null;
  };
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [correctingPhone, setCorrectingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(landlord.phone ?? "");
  const [phoneReason, setPhoneReason] = useState("");

  const [name, setName] = useState(landlord.name);
  const [email, setEmail] = useState(landlord.email ?? "");
  const [alternatePhone, setAlternatePhone] = useState(landlord.alternatePhone ?? "");
  const [gender, setGender] = useState<Gender>(
    (landlord.gender as Gender | null) ?? "PREFER_NOT_TO_SAY",
  );

  function save() {
    startTransition(async () => {
      const result = await updateLandlordAction({
        landlordId: landlord.id,
        name,
        email: email || null,
        alternatePhone: alternatePhone || null,
        gender,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Landlord updated.");
      setEditing(false);
      router.refresh();
    });
  }

  function correctPhone() {
    startTransition(async () => {
      const result = await correctLandlordPhoneAction(landlord.id, newPhone, phoneReason);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Phone number corrected.");
      setCorrectingPhone(false);
      setPhoneReason("");
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await archiveLandlordAction(landlord.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${landlord.name} archived.`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label={`Actions for ${landlord.name}`}>
        <Link href={`/landlords/${landlord.id}`} className="menu-item" role="menuitem">
          <Eye size={15} />
          View
        </Link>

        {canEdit && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => setEditing(true)}
          >
            <Pencil size={15} />
            Edit details
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            className="menu-item"
            role="menuitem"
            onClick={() => setCorrectingPhone(true)}
          >
            <PhoneForwarded size={15} />
            Correct phone number
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            className="menu-item menu-item--danger"
            role="menuitem"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
            Delete
          </button>
        )}
      </RowMenu>

      <Modal
        open={editing}
        title="Edit landlord"
        onClose={() => setEditing(false)}
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={save}
              disabled={pending || !name.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Save changes
            </button>
          </>
        }
      >
          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor={`ll-name-${landlord.id}`}>
                Name<span className="required">*</span>
              </label>
              <input
                id={`ll-name-${landlord.id}`}
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={`ll-email-${landlord.id}`}>
                Email
              </label>
              <input
                id={`ll-email-${landlord.id}`}
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={`ll-alt-${landlord.id}`}>
                Alternate phone
              </label>
              <input
                id={`ll-alt-${landlord.id}`}
                className="input numeric"
                inputMode="tel"
                value={alternatePhone}
                onChange={(event) => setAlternatePhone(event.target.value)}
              />
              <span className="field-hint">
                The main number is this landlord&apos;s identity and is corrected separately.
              </span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor={`ll-gender-${landlord.id}`}>
                Gender
              </label>
              <select
                id={`ll-gender-${landlord.id}`}
                className="select"
                value={gender}
                onChange={(event) => setGender(event.target.value as Gender)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
      </Modal>

      <Modal
        open={correctingPhone}
        title="Correct the phone number"
        onClose={() => setCorrectingPhone(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setCorrectingPhone(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={correctPhone}
              disabled={pending || !newPhone.trim() || !phoneReason.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Correct number
            </button>
          </>
        }
      >
        <div className="stack--sm stack">
          <div className="alert alert--warning">
            <AlertTriangle size={16} />
            <span>
              This number is how the system recognises {landlord.name}. Every call ever made to
              them is matched on it, so a correction is recorded with the old number against it.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`ll-phone-${landlord.id}`}>
              Corrected number<span className="required">*</span>
            </label>
            <input
              id={`ll-phone-${landlord.id}`}
              className="input numeric"
              inputMode="tel"
              value={newPhone}
              onChange={(event) => setNewPhone(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`ll-phone-reason-${landlord.id}`}>
              Reason<span className="required">*</span>
            </label>
            <textarea
              id={`ll-phone-reason-${landlord.id}`}
              className="input"
              rows={2}
              placeholder="Digit transposed on the call, landlord changed number..."
              value={phoneReason}
              onChange={(event) => setPhoneReason(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${landlord.name}?`}
        message={
          landlord.propertyCount > 0
            ? `This landlord has ${landlord.propertyCount} ${
                landlord.propertyCount === 1 ? "property" : "properties"
              }. Archive or reassign them first.`
            : "The record is archived rather than erased, so the call history stays intact. An admin can restore it."
        }
        confirmLabel="Delete"
        danger
        pending={pending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
