"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "MINE"; landlordId: string; landlordName: string }
  | { status: "MINE_POTENTIAL"; potentialId: string; name: string; followUpScheduledAt: string | null }
  | { status: "OTHER" }
  | { status: "FREE"; phoneE164: string; phoneLast10: string }
  | { status: "error"; message: string };

type OutcomeState = "idle" | "follow_up" | "submitting" | "done_followup";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function PhoneLookupModal({ open, onClose }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ status: "idle" });
  const [outcome, setOutcome] = useState<OutcomeState>("idle");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [notes, setNotes] = useState("");

  const phoneRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setPhone("");
    setLookup({ status: "idle" });
    setOutcome("idle");
    setFirstName(""); setLastName(""); setEmail("");
    setFollowUpDate(""); setFollowUpTime(""); setNotes("");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleLookup() {
    if (!phone.trim()) return;
    setLookup({ status: "loading" });
    setOutcome("idle");
    setFirstName(""); setLastName(""); setEmail(""); setFollowUpDate(""); setFollowUpTime(""); setNotes("");

    try {
      const res = await fetch("/api/workflow/check-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLookup({ status: "error", message: data.message ?? data.error ?? "Lookup failed." });
        return;
      }

      if (data.state === "MINE") {
        setLookup({ status: "MINE", landlordId: data.landlord.id, landlordName: data.landlord.name });
      } else if (data.state === "MINE_POTENTIAL") {
        setLookup({
          status: "MINE_POTENTIAL",
          potentialId: data.potential.id,
          name: data.potential.name,
          followUpScheduledAt: data.potential.followUpScheduledAt ?? null,
        });
      } else if (data.state === "OTHER") {
        setLookup({ status: "OTHER" });
      } else {
        setLookup({ status: "FREE", phoneE164: data.phoneE164, phoneLast10: data.phoneLast10 });
      }
    } catch {
      setLookup({ status: "error", message: "Network error. Please try again." });
    }
  }

  async function handleNotInterested() {
    setOutcome("submitting");
    try {
      await fetch("/api/workflow/not-interested", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          notes,
        }),
      });
    } finally {
      handleClose();
    }
  }

  async function handleFollowUpSubmit() {
    if (!firstName.trim() || !followUpDate || !followUpTime) return;
    setOutcome("submitting");

    const scheduledAt = new Date(`${followUpDate}T${followUpTime}`).toISOString();

    try {
      const res = await fetch("/api/workflow/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          notes: notes.trim() || null,
          scheduledAt,
        }),
      });
      if (res.ok) {
        setOutcome("done_followup");
        setTimeout(() => handleClose(), 2500);
      } else {
        const d = await res.json();
        setLookup({ status: "error", message: d.message ?? d.error ?? "Failed to schedule follow-up." });
        setOutcome("idle");
      }
    } catch {
      setLookup({ status: "error", message: "Network error." });
      setOutcome("idle");
    }
  }

  if (!open) return null;

  const isSubmitting = outcome === "submitting";
  const minDate = (() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 5);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 500, padding: "1.5rem",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "12px", padding: "1.75rem", width: "100%",
        maxWidth: "540px", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 8px 48px rgba(0,0,0,0.65)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <p className="section-label" style={{ margin: 0 }}>Landlord Phone Lookup</p>
          <button
            onClick={handleClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.1rem", padding: "0.25rem 0.4rem", borderRadius: "4px" }}
          >
            ✕
          </button>
        </div>

        {/* Phone input */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "1rem" }}>
          <label className="field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
            <span className="label">Phone Number</span>
            <input
              ref={phoneRef}
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setLookup({ status: "idle" }); setOutcome("idle"); }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              placeholder="+44 7700 900000"
              disabled={lookup.status === "loading"}
              autoFocus
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={handleLookup}
            disabled={!phone.trim() || lookup.status === "loading"}
            style={{ marginBottom: 0 }}
          >
            {lookup.status === "loading" ? "Looking up…" : "Lookup"}
          </button>
          {lookup.status !== "idle" && lookup.status !== "loading" && (
            <button
              className="btn btn-secondary"
              onClick={() => { setLookup({ status: "idle" }); setOutcome("idle"); setPhone(""); setFirstName(""); setLastName(""); setEmail(""); setFollowUpDate(""); setFollowUpTime(""); setNotes(""); }}
              style={{ marginBottom: 0 }}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Result States ── */}

        {lookup.status === "MINE" && (
          <div className="lookup-result lookup-result-mine">
            <span style={{ fontWeight: 700, color: "var(--brand-gold)" }}>Your Landlord</span>
            <p style={{ margin: "0.25rem 0 0.5rem" }}>
              <Link href={`/landlords/${lookup.landlordId}`} style={{ color: "var(--brand-gold)", fontWeight: 600 }} onClick={handleClose}>
                {lookup.landlordName}
              </Link>{" "}
              <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>is already registered under your account.</span>
            </p>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <Link href={`/portal/properties/add?landlordId=${lookup.landlordId}`} className="btn btn-primary" style={{ fontSize: "0.82rem" }} onClick={handleClose}>
                Add Property →
              </Link>
              <Link href={`/landlords/${lookup.landlordId}`} className="btn btn-secondary" style={{ fontSize: "0.82rem" }} onClick={handleClose}>
                Go to Landlord
              </Link>
            </div>
          </div>
        )}

        {lookup.status === "MINE_POTENTIAL" && (
          <div className="lookup-result lookup-result-mine">
            <span style={{ fontWeight: 700, color: "var(--brand-gold)" }}>Your Follow-Up Lead</span>
            <p style={{ margin: "0.25rem 0 0.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {lookup.name}
              {lookup.followUpScheduledAt && (
                <> — follow-up scheduled for{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {new Date(lookup.followUpScheduledAt).toLocaleString("en-GB", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </strong>
                </>
              )}
            </p>
            <Link href={`/potential-landlords/${lookup.potentialId}`} className="btn btn-primary" style={{ fontSize: "0.82rem" }} onClick={handleClose}>
              View Lead →
            </Link>
          </div>
        )}

        {lookup.status === "OTHER" && (
          <div className="lookup-result lookup-result-other">
            <span style={{ fontWeight: 700, color: "#f87171" }}>Number Taken</span>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              This number is registered with another agent. The owner has been notified by email and in-app notification.
            </p>
          </div>
        )}

        {lookup.status === "error" && (
          <div className="lookup-result lookup-result-other">
            <span style={{ fontWeight: 700, color: "#f87171" }}>Error</span>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>{lookup.message}</p>
          </div>
        )}

        {lookup.status === "FREE" && outcome !== "done_followup" && (
          <div className="lookup-result lookup-result-free">
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{ fontWeight: 700, color: "#4ade80" }}>Number Available</span>
              <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                This number is not registered. Enter landlord details to continue.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">First Name</span>
                <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
              </label>
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="label">Last Name</span>
                <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
              </label>
            </div>
            <label className="field" style={{ marginBottom: "0.6rem" }}>
              <span className="label">Email (optional)</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
            </label>
            <label className="field" style={{ marginBottom: "0.75rem" }}>
              <span className="label">Notes (optional)</span>
              <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes about this call…" style={{ resize: "vertical" }} />
            </label>

            {outcome === "idle" && (
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary"
                  disabled={!firstName.trim() || isSubmitting}
                  onClick={handleNotInterested}
                >
                  Not Interested
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={!firstName.trim()}
                  onClick={() => setOutcome("follow_up")}
                >
                  Follow Up
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!firstName.trim()}
                  onClick={() => {
                    const p = new URLSearchParams({
                      phone: phone.trim(),
                      firstName: firstName.trim(),
                      lastName: lastName.trim(),
                    });
                    if (email.trim()) p.set("email", email.trim());
                    router.push(`/portal/properties/add?${p.toString()}`);
                    onClose();
                  }}
                >
                  Interested — Add Property →
                </button>
              </div>
            )}

            {isSubmitting && (
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Saving…</p>
            )}

            {outcome === "follow_up" && (
              <div style={{ marginTop: "0.5rem", padding: "0.75rem", background: "var(--surface-raised, #1a1a28)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                <p style={{ margin: "0 0 0.6rem", fontWeight: 600, fontSize: "0.875rem", color: "var(--text)" }}>
                  Schedule Follow-Up
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.75rem" }}>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Date</span>
                    <input className="input" type="date" min={minDate} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
                  </label>
                  <label className="field" style={{ marginBottom: 0 }}>
                    <span className="label">Time</span>
                    <input className="input" type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} />
                  </label>
                </div>
                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    className="btn btn-primary"
                    disabled={!followUpDate || !followUpTime || isSubmitting}
                    onClick={handleFollowUpSubmit}
                  >
                    Confirm Follow-Up
                  </button>
                  <button className="btn btn-secondary" onClick={() => setOutcome("idle")} disabled={isSubmitting}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {outcome === "done_followup" && (
          <div className="lookup-result lookup-result-mine">
            <span style={{ fontWeight: 700, color: "#4ade80" }}>Follow-Up Scheduled</span>
            <p style={{ margin: "0.25rem 0 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Reminders will be sent 1 hour and 5 minutes before the call. Closing…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
