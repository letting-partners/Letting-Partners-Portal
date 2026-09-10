"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Lock,
  PhoneCall,
  PhoneOff,
  Search,
  ThumbsUp,
  UserCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Person } from "@/components/ui/Avatar";
import { formatDateTime, formatLongDate } from "@/lib/dates";
import { displayPhone, formatUKPhone } from "@/lib/phone";
import type { PhoneLookupResult } from "@/services/phone-lookup";
import {
  followUpAction,
  interestedAction,
  lookupAction,
  noAnswerAction,
  notInterestedAction,
  startCallAction,
} from "./actions";

/**
 * The call workflow.
 *
 * Step 1  look the number up and show exactly who owns it
 * Step 2  start the call (only if the number is claimable)
 * Step 3  record the outcome: interested, not interested, follow up, no answer
 *
 * The lookup result drives what the user is allowed to do next, but every
 * action is re-authorised on the server.
 */

type Stage = "LOOKUP" | "RESULT" | "IN_CALL" | "NOT_INTERESTED" | "FOLLOW_UP";

const NOT_INTERESTED_REASONS = [
  { value: "ALREADY_USING_AGENT", label: "Already using another agent" },
  { value: "NOT_CURRENTLY_RENTING", label: "Not currently renting" },
  { value: "NO_AGENCY_SERVICE", label: "Does not want an agency service" },
  { value: "PROPERTY_SOLD", label: "Property sold" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
  { value: "DO_NOT_CONTACT", label: "Asked not to be contacted" },
  { value: "OTHER", label: "Other" },
];

export default function CallWorkflow({
  initialPhone,
  initialFollowUpId,
}: {
  initialPhone?: string;
  initialFollowUpId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [stage, setStage] = useState<Stage>("LOOKUP");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [adUrl, setAdUrl] = useState("");
  const [openingNote, setOpeningNote] = useState("");
  const [lookup, setLookup] = useState<PhoneLookupResult | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runLookup = useCallback(
    (value: string) => {
      setError(null);
      startTransition(async () => {
        const result = await lookupAction(value);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setLookup(result.data);
        setStage("RESULT");
      });
    },
    [],
  );

  // Arriving from a follow-up row: look the number up straight away.
  useEffect(() => {
    if (initialPhone) runLookup(initialPhone);
    // Intentionally runs once for the number supplied in the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function beginCall(override = false) {
    setError(null);

    // Checked here as well as on the server, so the caller is told before the
    // round trip rather than after it.
    if (!adUrl.trim()) {
      setError("Add the advert link this number came from.");
      return;
    }
    startTransition(async () => {
      const result = await startCallAction({
        phone,
        followUpId:
          initialFollowUpId ??
          (lookup?.kind === "FOLLOW_UP_LOCKED" && lookup.isOwner ? lookup.followUp.id : null),
        override,
        adUrl,
        openingNote,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setCallId(result.data.callId);
      setStage("IN_CALL");
      toast.toast(`Call started (attempt ${result.data.attemptNumber}).`, "info");
    });
  }

  function chooseInterested() {
    if (!callId) return;
    startTransition(async () => {
      const result = await interestedAction(callId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.data.nextHref);
    });
  }

  function chooseNoAnswer() {
    if (!callId) return;
    startTransition(async () => {
      const result = await noAnswerAction(callId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Logged as no answer.");
      reset();
    });
  }

  function reset() {
    setStage("LOOKUP");
    setPhone("");
    setLookup(null);
    setCallId(null);
    setError(null);
  }

  return (
    <div className="stack">
      {error && (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {stage === "LOOKUP" && (
        <LookupStep
          phone={phone}
          onPhoneChange={setPhone}
          onSubmit={() => runLookup(phone)}
          pending={pending}
        />
      )}

      {stage === "RESULT" && lookup && (
        <>
          {/* Asked before the call, not after: which advert produced the lead
              is knowable now and guesswork later. */}
          <div className="card">
            <div className="card-body form-grid">
              <div className="field">
                <label className="field-label" htmlFor="call-ad-url">
                  Advert link<span className="required">*</span>
                </label>
                <input
                  id="call-ad-url"
                  className="input"
                  type="url"
                  inputMode="url"
                  placeholder="https://www.spareroom.co.uk/..."
                  value={adUrl}
                  onChange={(event) => setAdUrl(event.target.value)}
                />
                <span className="field-hint">
                  The listing this number was advertised on.
                </span>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="call-opening-note">
                  Note
                </label>
                <textarea
                  id="call-opening-note"
                  className="input"
                  rows={2}
                  placeholder="What the advert says, or why you are calling."
                  value={openingNote}
                  onChange={(event) => setOpeningNote(event.target.value)}
                />
              </div>
            </div>
          </div>

          <LookupResult
            result={lookup}
            pending={pending}
            onStartCall={beginCall}
            onBack={reset}
          />
        </>
      )}

      {stage === "IN_CALL" && (
        <OutcomeStep
          phone={phone}
          pending={pending}
          onInterested={chooseInterested}
          onNotInterested={() => setStage("NOT_INTERESTED")}
          onFollowUp={() => setStage("FOLLOW_UP")}
          onNoAnswer={chooseNoAnswer}
        />
      )}

      {stage === "NOT_INTERESTED" && callId && (
        <NotInterestedForm
          callId={callId}
          onCancel={() => setStage("IN_CALL")}
          onSaved={() => {
            toast.success("Saved to Not interested.");
            reset();
            router.refresh();
          }}
          onError={setError}
        />
      )}

      {stage === "FOLLOW_UP" && callId && (
        <FollowUpForm
          callId={callId}
          onCancel={() => setStage("IN_CALL")}
          onSaved={() => {
            toast.success("Follow-up scheduled and locked to you.");
            reset();
            router.refresh();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- step one */

function LookupStep({
  phone,
  onPhoneChange,
  onSubmit,
  pending,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="field">
        <label className="field-label" htmlFor="lookup-phone">
          Landlord number
          <span className="required" aria-hidden="true">
            *
          </span>
        </label>
        <div className="input-group">
          <Search size={15} aria-hidden="true" />
          <input
            id="lookup-phone"
            className="input"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            placeholder="07911 123456"
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
          />
        </div>
        <span className="field-hint">
          Any UK format works. We match on the last 10 digits, so +44, 0044 and a leading zero
          all resolve to the same landlord.
        </span>
      </div>

      <button type="submit" className="btn btn--primary" disabled={pending || !phone.trim()}>
        {pending && <span className="spinner" aria-hidden="true" />}
        Look up number
      </button>
    </form>
  );
}

/* ------------------------------------------------------------- step two */

function LookupResult({
  result,
  pending,
  onStartCall,
  onBack,
}: {
  result: PhoneLookupResult;
  pending: boolean;
  onStartCall: (override?: boolean) => void;
  onBack: () => void;
}) {
  if (result.kind === "INVALID") {
    return (
      <div className="stack">
        <div className="lookup-result lookup-result--blocked">
          <div className="lookup-title">That number is not valid</div>
          <p className="small">{result.message}</p>
        </div>
        <button type="button" className="btn btn--secondary" onClick={onBack}>
          Try another number
        </button>
      </div>
    );
  }

  if (result.kind === "AVAILABLE") {
    return (
      <div className="stack">
        <div className="lookup-result lookup-result--available">
          <div className="lookup-title">
            <CheckCircle2 size={16} style={{ display: "inline", marginRight: 6 }} />
            Number available
          </div>
          <p className="small">
            {formatUKPhone(result.normalizedPhone)} is not on the system. You can start a call.
          </p>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => onStartCall(false)}
            disabled={pending}
          >
            {pending && <span className="spinner" aria-hidden="true" />}
            <PhoneCall size={15} />
            Start call
          </button>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (result.kind === "EXISTING_LANDLORD") {
    return (
      <div className="stack">
        <div className="lookup-result lookup-result--existing">
          <div className="lookup-title">
            <UserCheck size={16} style={{ display: "inline", marginRight: 6 }} />
            Existing landlord found
          </div>

          <dl className="definition-list" style={{ marginTop: 10 }}>
            <div>
              <dt>Landlord</dt>
              <dd>{result.landlord.name}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd className="numeric">
                {displayPhone(result.landlord.displayPhone, result.normalizedPhone)}
              </dd>
            </div>
            <div>
              <dt>Assigned fronter</dt>
              <dd>
                <Person name={result.fronter?.fullName} src={result.fronter?.avatarUrl} />
              </dd>
            </div>
            <div>
              <dt>Assigned agent</dt>
              <dd>
                <Person name={result.agent?.fullName} src={result.agent?.avatarUrl} />
              </dd>
            </div>
            <div>
              <dt>Properties</dt>
              <dd>{result.landlord.propertyCount}</dd>
            </div>
            <div>
              <dt>Last contact</dt>
              <dd>
                {result.landlord.lastContactAt
                  ? formatDateTime(result.landlord.lastContactAt)
                  : "No contact recorded"}
              </dd>
            </div>
          </dl>

          {!result.canView && (
            <p className="small" style={{ marginTop: 10 }}>
              This landlord belongs to another team, so the record is not open to you.
            </p>
          )}
        </div>

        <div className="row">
          {result.canView && (
            <Link href={`/landlords/${result.landlord.id}`} className="btn btn--primary">
              View landlord
            </Link>
          )}
          <button type="button" className="btn btn--secondary" onClick={onBack}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (result.kind === "FOLLOW_UP_LOCKED") {
    return (
      <div className="stack">
        <div className="lookup-result lookup-result--locked">
          <div className="lookup-title">
            <Lock size={16} style={{ display: "inline", marginRight: 6 }} />
            {result.isOwner ? "Your follow up" : "Follow up locked"}
          </div>

          <dl className="definition-list" style={{ marginTop: 10 }}>
            <div>
              <dt>Assigned fronter</dt>
              <dd>
                <Person name={result.owner?.fullName} src={result.owner?.avatarUrl} />
              </dd>
            </div>
            <div>
              <dt>Follow-up date</dt>
              <dd>{formatLongDate(result.followUp.dueAt)}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>
                <StatusBadge status={result.followUp.priority} />
              </dd>
            </div>
            <div>
              <dt>Last note</dt>
              <dd>{result.followUp.lastNote}</dd>
            </div>
          </dl>

          {!result.isOwner && !result.requiresOverride && (
            <p className="small" style={{ marginTop: 10 }}>
              This number belongs to another fronter until their follow-up is completed or
              cancelled.
            </p>
          )}
        </div>

        <div className="row">
          {result.isOwner && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => onStartCall(false)}
              disabled={pending}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              <PhoneCall size={15} />
              Continue follow up
            </button>
          )}

          {!result.isOwner && result.requiresOverride && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onStartCall(true)}
              disabled={pending}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Override and call
            </button>
          )}

          <button type="button" className="btn btn--secondary" onClick={onBack}>
            Close
          </button>
        </div>

        {!result.isOwner && result.requiresOverride && (
          <p className="subtle small">
            Overriding another user&apos;s follow-up is recorded in the audit log.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="lookup-result lookup-result--blocked">
        <div className="lookup-title">
          <PhoneOff size={16} style={{ display: "inline", marginRight: 6 }} />
          Previously marked not interested
        </div>

        <dl className="definition-list" style={{ marginTop: 10 }}>
          <div>
            <dt>Last attempted by</dt>
            <dd>
              <Person name={result.lastAttemptBy?.fullName} src={result.lastAttemptBy?.avatarUrl} />
            </dd>
          </div>
          <div>
            <dt>Last attempt</dt>
            <dd>{formatLongDate(result.record.createdAt)}</dd>
          </div>
          <div>
            <dt>Reason</dt>
            <dd>
              <StatusBadge status={result.record.reason} />
            </dd>
          </div>
          <div>
            <dt>Notes</dt>
            <dd>{result.record.notes ?? "No notes recorded."}</dd>
          </div>
          <div>
            <dt>Attempts</dt>
            <dd>{result.attempts}</dd>
          </div>
        </dl>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => onStartCall(false)}
          disabled={pending}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          <PhoneCall size={15} />
          Retry call
        </button>
        <button type="button" className="btn btn--secondary" onClick={onBack}>
          Close
        </button>
      </div>

      <p className="subtle small">
        A retry adds a new attempt. Previous attempts stay on the record.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- step three */

function OutcomeStep({
  phone,
  pending,
  onInterested,
  onNotInterested,
  onFollowUp,
  onNoAnswer,
}: {
  phone: string;
  pending: boolean;
  onInterested: () => void;
  onNotInterested: () => void;
  onFollowUp: () => void;
  onNoAnswer: () => void;
}) {
  return (
    <div className="stack">
      <div className="alert alert--info">
        <PhoneCall size={16} />
        <span>
          Call in progress to <strong className="numeric">{phone}</strong>. Record the outcome when
          you are done.
        </span>
      </div>

      <div className="outcome-grid">
        <button
          type="button"
          className="outcome-btn"
          data-tone="positive"
          onClick={onInterested}
          disabled={pending}
        >
          <ThumbsUp size={20} />
          Interested
          <span className="subtle small">Add landlord and property</span>
        </button>

        <button
          type="button"
          className="outcome-btn"
          data-tone="warning"
          onClick={onFollowUp}
          disabled={pending}
        >
          <CalendarClock size={20} />
          Follow up
          <span className="subtle small">Call back later</span>
        </button>

        <button
          type="button"
          className="outcome-btn"
          data-tone="danger"
          onClick={onNotInterested}
          disabled={pending}
        >
          <PhoneOff size={20} />
          Not interested
          <span className="subtle small">Record the reason</span>
        </button>
      </div>

      <button type="button" className="btn btn--ghost" onClick={onNoAnswer} disabled={pending}>
        No answer
      </button>
    </div>
  );
}

function NotInterestedForm({
  callId,
  onCancel,
  onSaved,
  onError,
}: {
  callId: string;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState(NOT_INTERESTED_REASONS[0].value);
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await notInterestedAction({
            callId,
            reason,
            notes: notes.trim() || null,
            contactName: contactName.trim() || null,
          });
          if (!result.ok) {
            onError(result.error);
            return;
          }
          onSaved();
        });
      }}
    >
      <h2>Why were they not interested?</h2>

      <div className="field">
        <label className="field-label" htmlFor="ni-reason">
          Reason
          <span className="required" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="ni-reason"
          className="select"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        >
          {NOT_INTERESTED_REASONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="ni-name">
          Contact name
        </label>
        <input
          id="ni-name"
          className="input"
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="ni-notes">
          Notes
        </label>
        <textarea
          id="ni-notes"
          className="textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Anything useful for the next person who calls this number."
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={pending}>
          Back
        </button>
        <button type="submit" className="btn btn--primary" disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          Save
        </button>
      </div>
    </form>
  );
}

function FollowUpForm({
  callId,
  onCancel,
  onSaved,
  onError,
}: {
  callId: string;
  onCancel: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [dueAt, setDueAt] = useState(defaultFollowUpDateTime());
  const [priority, setPriority] = useState("NORMAL");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await followUpAction({
            callId,
            dueAt,
            priority,
            reason: reason.trim() || null,
            notes,
            contactName: contactName.trim() || null,
          });
          if (!result.ok) {
            onError(result.error);
            return;
          }
          onSaved();
        });
      }}
    >
      <h2>Schedule a follow up</h2>
      <p className="muted small">
        The number is locked to you until the follow-up is completed or cancelled.
      </p>

      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="fu-due">
            Follow-up date and time
            <span className="required" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="fu-due"
            type="datetime-local"
            className="input"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            required
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="fu-priority">
            Priority
          </label>
          <select
            id="fu-priority"
            className="select"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="fu-name">
            Contact name
          </label>
          <input
            id="fu-name"
            className="input"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="fu-reason">
            Reason
          </label>
          <input
            id="fu-reason"
            className="input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Asked to call back Friday"
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="fu-notes">
          Notes
          <span className="required" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="fu-notes"
          className="textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          required
          placeholder="What did the landlord say? What should the next call open with?"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={pending}>
          Back
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={pending || !notes.trim() || !dueAt}
        >
          {pending && <span className="spinner" aria-hidden="true" />}
          Schedule follow up
        </button>
      </div>
    </form>
  );
}

/** Tomorrow at 10:00, formatted for a datetime-local input. */
function defaultFollowUpDateTime(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
