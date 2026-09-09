"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { RowMenu } from "@/components/ui/RowMenu";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { archiveTenantAction, updateTenantAction } from "./actions";

/**
 * Per-row actions for the tenants table.
 *
 * The fields here are the ones that get corrected after a registration call -
 * a misheard name, a changed area, a requirement that has moved on. Budget and
 * property preferences are edited on the tenant's own page, where there is
 * room to show them properly.
 */
export default function TenantRowActions({
  tenant,
  canEdit,
  isAdmin,
}: {
  tenant: {
    id: string;
    name: string;
    email: string | null;
    area: string | null;
    postcodePreferences: string | null;
    requirements: string | null;
    status: string;
  };
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState(tenant.name);
  const [email, setEmail] = useState(tenant.email ?? "");
  const [area, setArea] = useState(tenant.area ?? "");
  const [postcodes, setPostcodes] = useState(tenant.postcodePreferences ?? "");
  const [requirements, setRequirements] = useState(tenant.requirements ?? "");
  const [status, setStatus] = useState(tenant.status);

  function save() {
    startTransition(async () => {
      const result = await updateTenantAction(tenant.id, {
        name,
        email: email || null,
        area: area || null,
        postcodePreferences: postcodes || null,
        requirements: requirements || null,
        status,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Tenant updated.");
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await archiveTenantAction(tenant.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${tenant.name} deleted.`);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  return (
    <>
      <RowMenu label={`Actions for ${tenant.name}`}>
        <Link href={`/tenants/${tenant.id}`} className="menu-item" role="menuitem">
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
        title="Edit tenant"
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
            <label className="field-label" htmlFor={`t-name-${tenant.id}`}>
              Name<span className="required">*</span>
            </label>
            <input
              id={`t-name-${tenant.id}`}
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`t-email-${tenant.id}`}>
              Email
            </label>
            <input
              id={`t-email-${tenant.id}`}
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`t-area-${tenant.id}`}>
              Area
            </label>
            <input
              id={`t-area-${tenant.id}`}
              className="input"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`t-postcodes-${tenant.id}`}>
              Postcode preferences
            </label>
            <input
              id={`t-postcodes-${tenant.id}`}
              className="input"
              value={postcodes}
              onChange={(event) => setPostcodes(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor={`t-status-${tenant.id}`}>
              Status
            </label>
            <select
              id={`t-status-${tenant.id}`}
              className="select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="VIEWING">Viewing</option>
              <option value="NEGOTIATING">Negotiating</option>
              <option value="PLACED">Placed</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label" htmlFor={`t-req-${tenant.id}`}>
              Requirements
            </label>
            <textarea
              id={`t-req-${tenant.id}`}
              className="input"
              rows={3}
              value={requirements}
              onChange={(event) => setRequirements(event.target.value)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${tenant.name}?`}
        message="The record is archived rather than erased, so viewings and deals that reference this tenant stay intact. A tenant with a live deal cannot be deleted until it is closed or cancelled."
        confirmLabel="Delete"
        danger
        pending={pending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </>
  );
}
