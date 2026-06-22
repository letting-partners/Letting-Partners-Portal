"use client";

import { FormEvent, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import {
  createDialerContact,
  createDialerLabel,
  deleteDialerContact,
  deleteDialerLabel,
  updateDialerContact,
  type DialerContactRow,
  type DialerLabelRow,
} from "@/lib/portal-api";
import { formatDateTime } from "@/lib/format";

type Props = {
  initialContacts: DialerContactRow[];
  initialLabels: DialerLabelRow[];
};

type ContactForm = {
  id: string | null;
  fullName: string;
  phoneNumber: string;
  extensionNumber: string;
  email: string;
  notes: string;
  isFavorite: boolean;
  labelIds: string[];
};

const EMPTY_FORM: ContactForm = {
  id: null,
  fullName: "",
  phoneNumber: "",
  extensionNumber: "",
  email: "",
  notes: "",
  isFavorite: false,
  labelIds: [],
};

export function DialerContactsClient({ initialContacts, initialLabels }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [labels, setLabels] = useState(initialLabels);
  const [search, setSearch] = useState("");
  const [activeLabelFilter, setActiveLabelFilter] = useState<string>("ALL");
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const [savingContact, setSavingContact] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#C69A4B");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const matchesSearch =
        query.length === 0 ||
        contact.fullName.toLowerCase().includes(query) ||
        contact.phoneNumber.toLowerCase().includes(query) ||
        (contact.extensionNumber ?? "").toLowerCase().includes(query) ||
        (contact.email ?? "").toLowerCase().includes(query);
      const matchesLabel =
        activeLabelFilter === "ALL" ||
        contact.labels.some((label) => label.id === activeLabelFilter);
      return matchesSearch && matchesLabel;
    });
  }, [activeLabelFilter, contacts, search]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function startEdit(contact: DialerContactRow) {
    setForm({
      id: contact.id,
      fullName: contact.fullName,
      phoneNumber: contact.phoneNumber,
      extensionNumber: contact.extensionNumber ?? "",
      email: contact.email ?? "",
      notes: contact.notes ?? "",
      isFavorite: contact.isFavorite,
      labelIds: contact.labels.map((label) => label.id),
    });
  }

  function toggleFormLabel(labelId: string) {
    setForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.includes(labelId)
        ? prev.labelIds.filter((id) => id !== labelId)
        : [...prev.labelIds, labelId],
    }));
  }

  async function handleSubmitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingContact(true);
    setMessage(null);

    const payload = {
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      extensionNumber: form.extensionNumber.trim() || null,
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
      isFavorite: form.isFavorite,
      labelIds: form.labelIds,
    };

    const result = form.id
      ? await updateDialerContact(form.id, payload)
      : await createDialerContact(payload);
    setSavingContact(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to save contact." });
      return;
    }

    setContacts((prev) => {
      if (form.id) {
        return prev.map((contact) => (contact.id === result.data.contact.id ? result.data.contact : contact));
      }
      return [result.data.contact, ...prev];
    });
    setMessage({ type: "success", text: result.data.message });
    resetForm();
  }

  async function handleDeleteContact(contactId: string) {
    setDeletingContactId(contactId);
    setMessage(null);
    const result = await deleteDialerContact(contactId);
    setDeletingContactId(null);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to delete contact." });
      return;
    }

    setContacts((prev) => prev.filter((contact) => contact.id !== contactId));
    if (form.id === contactId) resetForm();
    setMessage({ type: "success", text: result.data.message });
  }

  async function handleCreateLabel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingLabel(true);
    setMessage(null);
    const result = await createDialerLabel({
      name: labelName.trim(),
      colorHex: labelColor,
    });
    setSavingLabel(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to create label." });
      return;
    }

    setLabels((prev) => [...prev, result.data.label].sort((a, b) => a.name.localeCompare(b.name)));
    setLabelName("");
    setLabelColor("#C69A4B");
    setMessage({ type: "success", text: result.data.message });
  }

  async function handleDeleteLabel(labelId: string) {
    setDeletingLabelId(labelId);
    setMessage(null);
    const result = await deleteDialerLabel(labelId);
    setDeletingLabelId(null);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to delete label." });
      return;
    }

    setLabels((prev) => prev.filter((label) => label.id !== labelId));
    setContacts((prev) =>
      prev.map((contact) => ({
        ...contact,
        labels: contact.labels.filter((label) => label.id !== labelId),
      })),
    );
    setForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.filter((id) => id !== labelId),
    }));
    if (activeLabelFilter === labelId) setActiveLabelFilter("ALL");
    setMessage({ type: "success", text: result.data.message });
  }

  return (
    <div className="stack">
      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <div className="dialer-grid">
        <section className="dialer-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">
              {form.id ? "Edit Contact" : "Add Contact"}
            </h2>
          </div>
          <form className="field-grid" onSubmit={handleSubmitContact}>
            <div className="two-col">
              <label className="field">
                <span className="label">Full Name</span>
                <UIInput
                  value={form.fullName}
                  onChange={(event) => setForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Phone Number</span>
                <UIInput
                  value={form.phoneNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                  required
                />
              </label>
            </div>

            <div className="two-col">
              <label className="field">
                <span className="label">Extension (Optional)</span>
                <UIInput
                  value={form.extensionNumber}
                  onChange={(event) => setForm((prev) => ({ ...prev, extensionNumber: event.target.value }))}
                />
              </label>
              <label className="field">
                <span className="label">Email (Optional)</span>
                <UIInput
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
            </div>

            <label className="field">
              <span className="label">Notes</span>
              <textarea
                className="textarea"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Call context, best contact time, etc."
              />
            </label>

            <label className="inline-row" style={{ alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.isFavorite}
                onChange={(event) => setForm((prev) => ({ ...prev, isFavorite: event.target.checked }))}
              />
              <span style={{ fontSize: "0.88rem", color: "var(--text)" }}>
                Mark as favorite
              </span>
            </label>

            <div className="field">
              <span className="label">Labels</span>
              {labels.length === 0 ? (
                <p className="hint-text" style={{ margin: 0 }}>
                  Create labels first to organize contacts.
                </p>
              ) : (
                <div className="dialer-label-picker">
                  {labels.map((label) => (
                    <label key={label.id} className="dialer-label-option">
                      <input
                        type="checkbox"
                        checked={form.labelIds.includes(label.id)}
                        onChange={() => toggleFormLabel(label.id)}
                      />
                      <span className="dialer-label-chip" style={{ borderColor: label.colorHex, color: label.colorHex }}>
                        {label.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="inline-row">
              <UIButton type="submit" disabled={savingContact}>
                {savingContact ? "Saving..." : form.id ? "Update Contact" : "Add Contact"}
              </UIButton>
              {form.id && (
                <UIButton
                  type="button"
                  variant="secondary"
                  onClick={resetForm}
                >
                  Cancel Edit
                </UIButton>
              )}
            </div>
          </form>
        </section>

        <section className="dialer-card">
          <div className="dialer-card-head">
            <h2 className="dialer-card-title">Labels</h2>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{labels.length} total</span>
          </div>
          <form className="field-grid" onSubmit={handleCreateLabel}>
            <label className="field">
              <span className="label">Label Name</span>
              <UIInput value={labelName} onChange={(event) => setLabelName(event.target.value)} required />
            </label>
            <label className="field">
              <span className="label">Color</span>
              <div className="inline-row">
                <input
                  type="color"
                  value={labelColor}
                  onChange={(event) => setLabelColor(event.target.value.toUpperCase())}
                  style={{ width: 44, height: 36, border: "1px solid var(--border)", borderRadius: 8, background: "transparent" }}
                />
                <UIInput
                  value={labelColor}
                  onChange={(event) => setLabelColor(event.target.value.toUpperCase())}
                  maxLength={7}
                  style={{ maxWidth: 120 }}
                />
              </div>
            </label>
            <UIButton type="submit" disabled={savingLabel}>
              {savingLabel ? "Creating..." : "Create Label"}
            </UIButton>
          </form>

          <div className="dialer-label-list">
            {labels.map((label) => (
              <div key={label.id} className="dialer-label-row">
                <button
                  type="button"
                  className={`dialer-label-row-chip${activeLabelFilter === label.id ? " active" : ""}`}
                  style={{ borderColor: label.colorHex, color: label.colorHex }}
                  onClick={() =>
                    setActiveLabelFilter((prev) => (prev === label.id ? "ALL" : label.id))
                  }
                >
                  {label.name} ({label.contactsCount})
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => void handleDeleteLabel(label.id)}
                  disabled={deletingLabelId === label.id}
                >
                  {deletingLabelId === label.id ? "..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="dialer-card">
        <div className="dialer-card-head">
          <h2 className="dialer-card-title">Saved Contacts</h2>
          <div className="inline-row">
            <UIInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, number, extension..."
              style={{ minWidth: 260 }}
            />
            <UIButton
              variant="secondary"
              onClick={() => setActiveLabelFilter("ALL")}
              disabled={activeLabelFilter === "ALL"}
            >
              All Labels
            </UIButton>
          </div>
        </div>

        {filteredContacts.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No contacts match your filters.
          </p>
        ) : (
          <div className="dialer-contact-table">
            {filteredContacts.map((contact) => (
              <article key={contact.id} className="dialer-contact-card">
                <div className="dialer-contact-card-head">
                  <div>
                    <p className="dialer-contact-card-title">
                      {contact.fullName}
                      {contact.isFavorite ? <span className="dialer-favorite-star">*</span> : null}
                    </p>
                    <p className="dialer-contact-card-meta">
                      {contact.phoneNumber}
                      {contact.extensionNumber ? ` | Ext ${contact.extensionNumber}` : ""}
                    </p>
                  </div>
                  <div className="inline-row">
                    <UIButton variant="secondary" onClick={() => startEdit(contact)}>
                      Edit
                    </UIButton>
                    <UIButton
                      variant="danger"
                      onClick={() => void handleDeleteContact(contact.id)}
                      disabled={deletingContactId === contact.id}
                    >
                      {deletingContactId === contact.id ? "Deleting..." : "Delete"}
                    </UIButton>
                  </div>
                </div>

                <div className="dialer-contact-card-body">
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.82rem" }}>
                    {contact.email || "No email"} | Updated {formatDateTime(contact.updatedAt)}
                  </p>
                  {contact.notes ? (
                    <p style={{ margin: "0.45rem 0 0", fontSize: "0.84rem", color: "var(--text)" }}>
                      {contact.notes}
                    </p>
                  ) : null}
                  {contact.labels.length > 0 ? (
                    <div className="dialer-label-chip-wrap">
                      {contact.labels.map((label) => (
                        <span
                          key={label.id}
                          className="dialer-label-chip"
                          style={{ borderColor: label.colorHex, color: label.colorHex }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="hint-text" style={{ margin: "0.45rem 0 0" }}>
                      No labels assigned.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
