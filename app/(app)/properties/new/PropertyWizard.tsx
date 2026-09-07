"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { CommissionInput, MoneyInput, RentInput } from "@/components/ui/MoneyInput";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDraft, useSavedLabel } from "@/hooks/useDraft";
import { formatGBP, monthlyToWeeklyPence, weeklyToMonthlyPence } from "@/lib/money";
import { formatPostcode, isValidPostcode } from "@/lib/postcode";
import { formatUKPhone } from "@/lib/phone";
import {
  checkDuplicatesAction,
  createLandlordAction,
  createPropertyAction,
} from "./actions";

/**
 * Landlord and property onboarding.
 *
 * Seven steps, one screen at a time, with the whole form autosaved so a
 * refresh loses nothing. The landlord is committed at the end of step 1 - a
 * fronter who wins a landlord keeps the credit even if they stop there.
 */

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const STEPS: { index: Step; label: string }[] = [
  { index: 1, label: "Landlord" },
  { index: 2, label: "Address" },
  { index: 3, label: "Type" },
  { index: 4, label: "Features" },
  { index: 5, label: "Rent" },
  { index: 6, label: "Public details" },
  { index: 7, label: "Review" },
];

const FEATURES = [
  { key: "furnished", label: "Furnished" },
  { key: "livingLandlord", label: "Living landlord" },
  { key: "garden", label: "Garden" },
  { key: "parking", label: "Parking" },
  { key: "billsIncluded", label: "Bills included" },
  { key: "balcony", label: "Balcony / roof terrace" },
  { key: "disabledAccess", label: "Disabled access" },
  { key: "wifi", label: "Wi-Fi" },
  { key: "couplesAllowed", label: "Couples allowed" },
  { key: "petsAllowed", label: "Pets allowed" },
  { key: "dssAllowed", label: "DSS allowed" },
  { key: "childrenAllowed", label: "Children allowed" },
] as const;

type FeatureKey = (typeof FEATURES)[number]["key"];

type RoomDraft = {
  key: string;
  name: string;
  availabilityDate: string;
  rentFrequency: "MONTHLY" | "WEEKLY";
  rentPence: number | null;
  depositPence: number | null;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: number | null;
};

type WizardState = {
  landlordId: string | null;
  landlordName: string;
  landlordEmail: string;
  landlordPhone: string;
  landlordGender: string;

  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  area: string;

  propertyType: "FULL" | "SHARED";
  category: "HOUSE" | "FLAT" | "STUDIO_FLAT";

  features: Partial<Record<FeatureKey, boolean | null>>;
  livingRoom: "SHARED" | "PRIVATE" | "NONE" | null;

  numberOfRooms: string;
  availableRooms: string;
  bathrooms: string;
  availabilityDate: string;
  rentPence: number | null;
  depositPence: number | null;
  commissionType: "PERCENTAGE" | "FIXED";
  commissionValue: number | null;

  rooms: RoomDraft[];

  addPublicDetailsNow: boolean;
  title: string;
  description: string;
};

function emptyRoom(index: number): RoomDraft {
  return {
    key: `room-${Date.now()}-${index}`,
    name: `Room ${index + 1}`,
    availabilityDate: "",
    rentFrequency: "MONTHLY",
    rentPence: null,
    depositPence: null,
    commissionType: "PERCENTAGE",
    commissionValue: 10_000,
  };
}

function initialState(phone: string, display: string): WizardState {
  return {
    landlordId: null,
    landlordName: "",
    landlordEmail: "",
    landlordPhone: display || (phone ? formatUKPhone(phone) : ""),
    landlordGender: "PREFER_NOT_TO_SAY",

    addressLine1: "",
    addressLine2: "",
    town: "",
    county: "",
    postcode: "",
    area: "",

    propertyType: "FULL",
    category: "HOUSE",

    features: {},
    livingRoom: null,

    numberOfRooms: "",
    availableRooms: "",
    bathrooms: "",
    availabilityDate: "",
    rentPence: null,
    depositPence: null,
    commissionType: "PERCENTAGE",
    commissionValue: 10_000,

    rooms: [emptyRoom(0)],

    addPublicDetailsNow: false,
    title: "",
    description: "",
  };
}

export default function PropertyWizard({
  callId,
  phone,
  display,
  existingLandlord,
}: {
  callId?: string;
  phone?: string;
  display?: string;
  existingLandlord?: { id: string; name: string; phone: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const draftKey = `lp_property_draft_${callId ?? phone ?? "manual"}`;
  const { restored, savedAt, save, clear } = useDraft<WizardState>(draftKey);
  const savedLabel = useSavedLabel(savedAt);

  const [state, setState] = useState<WizardState>(() => initialState(phone ?? "", display ?? ""));
  const [step, setStep] = useState<Step>(existingLandlord ? 2 : 1);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<
    { id: string; reference: string; formattedAddress: string; landlordName: string }[]
  >([]);
  const [duplicatesAcknowledged, setDuplicatesAcknowledged] = useState(false);

  // Restore an interrupted session once the draft has been read.
  useEffect(() => {
    if (restored) {
      setState(restored);
      if (restored.landlordId) setStep((current) => (current === 1 ? 2 : current));
    }
  }, [restored]);

  // An existing landlord arrives already created; skip step 1.
  useEffect(() => {
    if (existingLandlord) {
      setState((current) => ({
        ...current,
        landlordId: existingLandlord.id,
        landlordName: existingLandlord.name,
        landlordPhone: existingLandlord.phone,
      }));
    }
  }, [existingLandlord]);

  const update = useCallback(
    (patch: Partial<WizardState>) => {
      setState((current) => {
        const next = { ...current, ...patch };
        save(next);
        return next;
      });
      setError(null);
    },
    [save],
  );

  const isStudio = state.propertyType === "FULL" && state.category === "STUDIO_FLAT";

  /* ------------------------------------------------------------ step 1 */

  function submitLandlord() {
    if (!state.landlordName.trim()) {
      setError("Enter the landlord name.");
      return;
    }
    if (!state.landlordPhone.trim()) {
      setError("Enter the landlord phone number.");
      return;
    }

    startTransition(async () => {
      const result = await createLandlordAction({
        name: state.landlordName,
        email: state.landlordEmail || null,
        phone: state.landlordPhone,
        gender: state.landlordGender,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      update({ landlordId: result.data.landlordId });
      toast.success("Landlord saved.");
      setStep(2);
    });
  }

  /* ------------------------------------------------------------ step 2 */

  function submitAddress() {
    if (!state.addressLine1.trim()) {
      setError("Enter the property address.");
      return;
    }
    if (!isValidPostcode(state.postcode)) {
      setError("Enter a valid UK postcode, for example M14 5AB.");
      return;
    }

    startTransition(async () => {
      const result = await checkDuplicatesAction({
        addressLine1: state.addressLine1,
        postcode: state.postcode,
        landlordId: state.landlordId,
      });

      if (result.ok && result.data.length > 0) {
        setDuplicates(result.data);
        setDuplicatesAcknowledged(false);
        return;
      }

      setDuplicates([]);
      setStep(3);
    });
  }

  /* ------------------------------------------------------------ step 5 */

  function validateRentStep(): string | null {
    if (state.propertyType === "SHARED") {
      if (state.rooms.length === 0) return "A shared property needs at least one room.";
      for (const room of state.rooms) {
        if (!room.name.trim()) return "Every room needs a name.";
        if (!room.rentPence) return `Enter the rent for ${room.name || "each room"}.`;
      }
      return null;
    }

    if (!isStudio) {
      const total = Number(state.numberOfRooms);
      const available = Number(state.availableRooms);
      if (!total || total < 1) return "Enter the number of rooms.";
      if (state.availableRooms === "" || Number.isNaN(available)) {
        return "Enter how many rooms are available.";
      }
      if (available > total) return "Available rooms cannot be more than the number of rooms.";
    }

    if (!state.rentPence) return "Enter the monthly rent.";
    if (state.depositPence === null) return "Enter the deposit.";
    if (state.commissionValue === null) return "Enter the commission agreed with the landlord.";
    return null;
  }

  /* ------------------------------------------------------------ submit */

  function submitProperty() {
    const rentError = validateRentStep();
    if (rentError) {
      setError(rentError);
      setStep(5);
      return;
    }

    if (state.addPublicDetailsNow && (!state.title.trim() || !state.description.trim())) {
      setError("Add a title and description, or choose to add public details later.");
      setStep(6);
      return;
    }

    if (!state.landlordId) {
      setError("The landlord has not been saved yet. Go back to step 1.");
      setStep(1);
      return;
    }

    startTransition(async () => {
      const result = await createPropertyAction({
        landlordId: state.landlordId!,
        propertyType: state.propertyType,
        category: state.propertyType === "SHARED" ? "HOUSE" : state.category,

        addressLine1: state.addressLine1,
        addressLine2: state.addressLine2 || null,
        town: state.town || null,
        county: state.county || null,
        postcode: state.postcode,
        area: state.area || state.town || null,

        features: state.features as Record<string, boolean | null>,
        livingRoom: isStudio ? null : state.livingRoom,

        numberOfRooms:
          state.propertyType === "FULL" && !isStudio ? Number(state.numberOfRooms) : null,
        availableRooms:
          state.propertyType === "FULL" && !isStudio ? Number(state.availableRooms) : null,
        bathrooms: state.bathrooms ? Number(state.bathrooms) : null,
        availabilityDate:
          state.propertyType === "FULL" ? state.availabilityDate || null : null,
        rentPerMonthPence: state.propertyType === "FULL" ? state.rentPence : null,
        depositPence: state.propertyType === "FULL" ? state.depositPence : null,
        commissionType: state.propertyType === "FULL" ? state.commissionType : null,
        commissionValue: state.propertyType === "FULL" ? state.commissionValue : null,

        rooms:
          state.propertyType === "SHARED"
            ? state.rooms.map((room) => ({
                name: room.name,
                availabilityDate: room.availabilityDate || null,
                rentFrequency: room.rentFrequency,
                rentPence: room.rentPence!,
                depositPence: room.depositPence,
                commissionType: room.commissionType,
                commissionValue: room.commissionValue,
              }))
            : undefined,

        title: state.addPublicDetailsNow ? state.title : null,
        description: state.addPublicDetailsNow ? state.description : null,
        originatingCallId: callId ?? null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      clear();
      toast.success(
        result.data.listingStatus === "DRAFT"
          ? `${result.data.reference} saved as a draft.`
          : `${result.data.reference} is ready to publish.`,
      );
      router.push(`/properties/${result.data.propertyId}`);
    });
  }

  /* -------------------------------------------------------------- view */

  const canContinue = useMemo(() => {
    if (step === 1) return Boolean(state.landlordName.trim() && state.landlordPhone.trim());
    if (step === 2) return Boolean(state.addressLine1.trim() && state.postcode.trim());
    return true;
  }, [step, state]);

  return (
    <div className="stack">
      <nav className="wizard-steps" aria-label="Progress">
        {STEPS.map((item) => (
          <button
            key={item.index}
            type="button"
            className="wizard-step"
            data-state={
              item.index === step ? "current" : item.index < step ? "done" : "upcoming"
            }
            // Only steps already reached are navigable, so the form cannot be
            // skipped past a required field.
            disabled={item.index > step}
            onClick={() => setStep(item.index)}
          >
            <span className="wizard-step-index">
              {item.index < step ? <Check size={11} /> : item.index}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {error && (
        <div className="alert alert--danger" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">
          {step === 1 && (
            <StepLandlord state={state} update={update} disabled={Boolean(state.landlordId)} />
          )}

          {step === 2 && (
            <StepAddress
              state={state}
              update={update}
              duplicates={duplicates}
              acknowledged={duplicatesAcknowledged}
              onAcknowledge={() => {
                setDuplicatesAcknowledged(true);
                setDuplicates([]);
                setStep(3);
              }}
            />
          )}

          {step === 3 && <StepType state={state} update={update} />}
          {step === 4 && <StepFeatures state={state} update={update} isStudio={isStudio} />}
          {step === 5 && <StepRent state={state} update={update} isStudio={isStudio} />}
          {step === 6 && <StepPublicDetails state={state} update={update} />}
          {step === 7 && <StepReview state={state} isStudio={isStudio} />}
        </div>

        <div className="card-footer">
          <div className="row row--between" style={{ width: "100%" }}>
            <span className="autosave-note">
              {savedLabel && (
                <>
                  <Save size={12} />
                  {savedLabel}
                </>
              )}
            </span>

            <div className="row">
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={() => setStep((current) => (current - 1) as Step)}
                  disabled={pending}
                >
                  <ChevronLeft size={15} />
                  Back
                </button>
              )}

              {step === 1 && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={state.landlordId ? () => setStep(2) : submitLandlord}
                  disabled={pending || !canContinue}
                >
                  {pending && <span className="spinner" aria-hidden="true" />}
                  {state.landlordId ? "Continue" : "Save landlord and continue"}
                  <ChevronRight size={15} />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitAddress}
                  disabled={pending || !canContinue}
                >
                  {pending && <span className="spinner" aria-hidden="true" />}
                  Continue
                  <ChevronRight size={15} />
                </button>
              )}

              {step > 2 && step < 7 && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    if (step === 5) {
                      const rentError = validateRentStep();
                      if (rentError) {
                        setError(rentError);
                        return;
                      }
                    }
                    setStep((current) => (current + 1) as Step);
                  }}
                  disabled={pending}
                >
                  Continue
                  <ChevronRight size={15} />
                </button>
              )}

              {step === 7 && (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={submitProperty}
                  disabled={pending}
                >
                  {pending && <span className="spinner" aria-hidden="true" />}
                  {state.addPublicDetailsNow ? "Create property" : "Save as draft"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- step one */

type StepProps = {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
};

function StepLandlord({ state, update, disabled }: StepProps & { disabled: boolean }) {
  return (
    <div className="stack">
      <div>
        <h2>Landlord details</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          The phone number becomes this landlord&apos;s permanent identity on the system.
        </p>
      </div>

      {disabled && (
        <div className="alert alert--positive">
          <Check size={16} />
          <span>Landlord saved. Continue to the property address.</span>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="landlord-name">
            Landlord name<span className="required">*</span>
          </label>
          <input
            id="landlord-name"
            className="input"
            value={state.landlordName}
            disabled={disabled}
            onChange={(event) => update({ landlordName: event.target.value })}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="landlord-phone">
            Phone number<span className="required">*</span>
          </label>
          <input
            id="landlord-phone"
            className="input numeric"
            inputMode="tel"
            value={state.landlordPhone}
            disabled={disabled}
            onChange={(event) => update({ landlordPhone: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="landlord-email">
            Email
          </label>
          <input
            id="landlord-email"
            className="input"
            type="email"
            value={state.landlordEmail}
            disabled={disabled}
            onChange={(event) => update({ landlordEmail: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="landlord-gender">
            Gender<span className="required">*</span>
          </label>
          <select
            id="landlord-gender"
            className="select"
            value={state.landlordGender}
            disabled={disabled}
            onChange={(event) => update({ landlordGender: event.target.value })}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- step two */

function StepAddress({
  state,
  update,
  duplicates,
  acknowledged,
  onAcknowledge,
}: StepProps & {
  duplicates: { id: string; reference: string; formattedAddress: string; landlordName: string }[];
  acknowledged: boolean;
  onAcknowledge: () => void;
}) {
  return (
    <div className="stack">
      <div>
        <h2>Property address</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          The full address stays internal. The website only shows the area and outward code.
        </p>
      </div>

      {duplicates.length > 0 && !acknowledged && (
        <div className="alert alert--warning">
          <AlertTriangle size={16} />
          <div>
            <strong>This may already be on the system.</strong>
            <ul style={{ marginTop: 6 }}>
              {duplicates.map((item) => (
                <li key={item.id}>
                  <Link href={`/properties/${item.id}`} style={{ textDecoration: "underline" }}>
                    {item.reference} - {item.formattedAddress}
                  </Link>{" "}
                  <span className="subtle">({item.landlordName})</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ marginTop: 10 }}
              onClick={onAcknowledge}
            >
              This is a different property, continue
            </button>
          </div>
        </div>
      )}

      <div className="form-grid">
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="field-label" htmlFor="address1">
            Address line 1<span className="required">*</span>
          </label>
          <input
            id="address1"
            className="input"
            value={state.addressLine1}
            onChange={(event) => update({ addressLine1: event.target.value })}
            placeholder="42 Wilmslow Road"
            autoFocus
          />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="field-label" htmlFor="address2">
            Address line 2
          </label>
          <input
            id="address2"
            className="input"
            value={state.addressLine2}
            onChange={(event) => update({ addressLine2: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="town">
            Town / city
          </label>
          <input
            id="town"
            className="input"
            value={state.town}
            onChange={(event) => update({ town: event.target.value })}
            placeholder="Manchester"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="county">
            County
          </label>
          <input
            id="county"
            className="input"
            value={state.county}
            onChange={(event) => update({ county: event.target.value })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="postcode">
            Post code<span className="required">*</span>
          </label>
          <input
            id="postcode"
            className="input"
            value={state.postcode}
            // Uppercased and spaced on blur so the user is never fighting it
            // mid-typing.
            onChange={(event) => update({ postcode: event.target.value })}
            onBlur={(event) => update({ postcode: formatPostcode(event.target.value) })}
            placeholder="M14 5AB"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="area">
            Area
          </label>
          <input
            id="area"
            className="input"
            value={state.area}
            onChange={(event) => update({ area: event.target.value })}
            placeholder="Rusholme"
          />
          <span className="field-hint">Shown publicly with the outward code.</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- step three */

function StepType({ state, update }: StepProps) {
  return (
    <div className="stack">
      <div>
        <h2>Property type</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          A full property is let as one unit. A shared property is let room by room.
        </p>
      </div>

      <div className="outcome-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
        <button
          type="button"
          className="outcome-btn"
          style={{
            borderColor: state.propertyType === "FULL" ? "var(--accent)" : undefined,
            background: state.propertyType === "FULL" ? "var(--accent-soft)" : undefined,
          }}
          aria-pressed={state.propertyType === "FULL"}
          onClick={() => update({ propertyType: "FULL" })}
        >
          Full property
          <span className="subtle small">One tenancy for the whole property</span>
        </button>

        <button
          type="button"
          className="outcome-btn"
          style={{
            borderColor: state.propertyType === "SHARED" ? "var(--accent)" : undefined,
            background: state.propertyType === "SHARED" ? "var(--accent-soft)" : undefined,
          }}
          aria-pressed={state.propertyType === "SHARED"}
          onClick={() => update({ propertyType: "SHARED" })}
        >
          Shared property
          <span className="subtle small">Rent and availability managed per room</span>
        </button>
      </div>

      {state.propertyType === "FULL" && (
        <div className="field">
          <span className="field-label">Category</span>
          <div className="row row--wrap">
            {(
              [
                ["HOUSE", "House"],
                ["FLAT", "Flat"],
                ["STUDIO_FLAT", "Studio flat"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={state.category === value ? "btn btn--primary" : "btn btn--secondary"}
                onClick={() => update({ category: value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ step four */

function StepFeatures({ state, update, isStudio }: StepProps & { isStudio: boolean }) {
  return (
    <div className="stack">
      <div>
        <h2>Features</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          Leave anything you do not know unanswered - it can be filled in later.
        </p>
      </div>

      <div className="stack--sm stack">
        {FEATURES.map((feature) => {
          const value = state.features[feature.key] ?? null;
          return (
            <div
              key={feature.key}
              className="row row--between"
              style={{ paddingBottom: 8, borderBottom: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: "0.87rem" }}>{feature.label}</span>
              <div className="segmented" role="group" aria-label={feature.label}>
                <button
                  type="button"
                  data-tone="yes"
                  aria-pressed={value === true}
                  onClick={() =>
                    update({
                      features: { ...state.features, [feature.key]: value === true ? null : true },
                    })
                  }
                >
                  Yes
                </button>
                <button
                  type="button"
                  data-tone="no"
                  aria-pressed={value === false}
                  onClick={() =>
                    update({
                      features: { ...state.features, [feature.key]: value === false ? null : false },
                    })
                  }
                >
                  No
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isStudio && (
        <div className="field">
          <span className="field-label">Living room</span>
          <div className="row row--wrap">
            {(
              [
                ["PRIVATE", "Private"],
                ["SHARED", "Shared"],
                ["NONE", "None"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={state.livingRoom === value ? "btn btn--primary" : "btn btn--secondary"}
                onClick={() => update({ livingRoom: state.livingRoom === value ? null : value })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ step five */

function StepRent({ state, update, isStudio }: StepProps & { isStudio: boolean }) {
  if (state.propertyType === "SHARED") {
    return <SharedRooms state={state} update={update} />;
  }

  return (
    <div className="stack">
      <div>
        <h2>Rent and availability</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          {state.addressLine1}, {state.postcode}
        </p>
      </div>

      <div className="form-grid">
        {!isStudio && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="rooms-total">
                Number of rooms<span className="required">*</span>
              </label>
              <input
                id="rooms-total"
                className="input"
                inputMode="numeric"
                value={state.numberOfRooms}
                onChange={(event) =>
                  update({ numberOfRooms: event.target.value.replace(/\D/g, "") })
                }
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="rooms-available">
                Available rooms<span className="required">*</span>
              </label>
              <input
                id="rooms-available"
                className="input"
                inputMode="numeric"
                value={state.availableRooms}
                onChange={(event) =>
                  update({ availableRooms: event.target.value.replace(/\D/g, "") })
                }
                aria-invalid={
                  state.numberOfRooms !== "" &&
                  state.availableRooms !== "" &&
                  Number(state.availableRooms) > Number(state.numberOfRooms)
                }
              />
              {state.numberOfRooms !== "" &&
                state.availableRooms !== "" &&
                Number(state.availableRooms) > Number(state.numberOfRooms) && (
                  <span className="field-error">
                    Available rooms cannot exceed the number of rooms.
                  </span>
                )}
            </div>
          </>
        )}

        <div className="field">
          <label className="field-label" htmlFor="bathrooms">
            Bathrooms
          </label>
          <input
            id="bathrooms"
            className="input"
            inputMode="numeric"
            value={state.bathrooms}
            onChange={(event) => update({ bathrooms: event.target.value.replace(/\D/g, "") })}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="available-from">
            Availability date<span className="required">*</span>
          </label>
          <input
            id="available-from"
            type="date"
            className="input"
            value={state.availabilityDate}
            onChange={(event) => update({ availabilityDate: event.target.value })}
          />
        </div>
      </div>

      <div className="form-grid">
        <RentInput
          label="Rent per month"
          frequency="MONTHLY"
          value={state.rentPence}
          onChange={(pence) => update({ rentPence: pence })}
          required
        />

        <MoneyInput
          label="Deposit"
          value={state.depositPence}
          onChange={(pence) => update({ depositPence: pence })}
          required
        />

        <CommissionInput
          type={state.commissionType}
          onTypeChange={(type) => update({ commissionType: type })}
          value={state.commissionValue}
          onValueChange={(value) => update({ commissionValue: value })}
          monthlyRentPence={state.rentPence}
          required
        />
      </div>
    </div>
  );
}

function SharedRooms({ state, update }: StepProps) {
  function patchRoom(key: string, patch: Partial<RoomDraft>) {
    update({
      rooms: state.rooms.map((room) => (room.key === key ? { ...room, ...patch } : room)),
    });
  }

  return (
    <div className="stack">
      <div className="row row--between">
        <div>
          <h2>Rooms</h2>
          <p className="muted small" style={{ marginTop: 3 }}>
            Rent, deposit and availability are set per room.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => update({ rooms: [...state.rooms, emptyRoom(state.rooms.length)] })}
        >
          <Plus size={14} />
          Add room
        </button>
      </div>

      <div className="stack">
        {state.rooms.map((room, index) => (
          <div key={room.key} className="card">
            <div className="card-header">
              <span className="card-title">{room.name || `Room ${index + 1}`}</span>
              <div className="row">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() =>
                    update({
                      rooms: [
                        ...state.rooms,
                        { ...room, key: `room-${Date.now()}`, name: `${room.name} (copy)` },
                      ],
                    })
                  }
                >
                  <Copy size={13} />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={state.rooms.length === 1}
                  onClick={() =>
                    update({ rooms: state.rooms.filter((item) => item.key !== room.key) })
                  }
                >
                  <Trash2 size={13} />
                  Remove
                </button>
              </div>
            </div>

            <div className="card-body">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor={`room-name-${room.key}`}>
                    Room name<span className="required">*</span>
                  </label>
                  <input
                    id={`room-name-${room.key}`}
                    className="input"
                    value={room.name}
                    onChange={(event) => patchRoom(room.key, { name: event.target.value })}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor={`room-date-${room.key}`}>
                    Availability date<span className="required">*</span>
                  </label>
                  <input
                    id={`room-date-${room.key}`}
                    type="date"
                    className="input"
                    value={room.availabilityDate}
                    onChange={(event) =>
                      patchRoom(room.key, { availabilityDate: event.target.value })
                    }
                  />
                </div>

                <RentInput
                  label="Rent"
                  frequency={room.rentFrequency}
                  onFrequencyChange={(frequency) => patchRoom(room.key, { rentFrequency: frequency })}
                  value={room.rentPence}
                  onChange={(pence) => patchRoom(room.key, { rentPence: pence })}
                  required
                />

                <MoneyInput
                  label="Deposit"
                  value={room.depositPence}
                  onChange={(pence) => patchRoom(room.key, { depositPence: pence })}
                />

                <CommissionInput
                  type={room.commissionType}
                  onTypeChange={(type) => patchRoom(room.key, { commissionType: type })}
                  value={room.commissionValue}
                  onValueChange={(value) => patchRoom(room.key, { commissionValue: value })}
                  monthlyRentPence={
                    room.rentPence === null
                      ? null
                      : room.rentFrequency === "MONTHLY"
                        ? room.rentPence
                        : weeklyToMonthlyPence(room.rentPence)
                  }
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <RoomSummary rooms={state.rooms} />
    </div>
  );
}

function RoomSummary({ rooms }: { rooms: RoomDraft[] }) {
  const withRent = rooms.filter((room) => room.rentPence !== null);
  if (withRent.length === 0) return null;

  return (
    <div className="table-wrap card">
      <table className="table">
        <thead>
          <tr>
            <th>Room</th>
            <th>Available</th>
            <th className="numeric">Rent PCM</th>
            <th className="numeric">Rent PW</th>
            <th className="numeric">Deposit</th>
          </tr>
        </thead>
        <tbody>
          {withRent.map((room) => {
            const monthly =
              room.rentFrequency === "MONTHLY"
                ? room.rentPence!
                : weeklyToMonthlyPence(room.rentPence!);
            const weekly =
              room.rentFrequency === "WEEKLY"
                ? room.rentPence!
                : monthlyToWeeklyPence(room.rentPence!);

            return (
              <tr key={room.key}>
                <td className="table-primary">{room.name}</td>
                <td>{room.availabilityDate || "Not set"}</td>
                <td className="numeric">{formatGBP(monthly)}</td>
                <td className="numeric">{formatGBP(weekly)}</td>
                <td className="numeric">{formatGBP(room.depositPence)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- step six */

function StepPublicDetails({ state, update }: StepProps) {
  return (
    <div className="stack">
      <div>
        <h2>Public details</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          What appears on the website. You can add this now or come back to it later.
        </p>
      </div>

      <div className="outcome-grid" style={{ gridTemplateColumns: "repeat(2, minmax(0,1fr))" }}>
        <button
          type="button"
          className="outcome-btn"
          aria-pressed={state.addPublicDetailsNow}
          style={{
            borderColor: state.addPublicDetailsNow ? "var(--accent)" : undefined,
            background: state.addPublicDetailsNow ? "var(--accent-soft)" : undefined,
          }}
          onClick={() => update({ addPublicDetailsNow: true })}
        >
          Add now
          <span className="subtle small">Title and description</span>
        </button>

        <button
          type="button"
          className="outcome-btn"
          aria-pressed={!state.addPublicDetailsNow}
          style={{
            borderColor: !state.addPublicDetailsNow ? "var(--accent)" : undefined,
            background: !state.addPublicDetailsNow ? "var(--accent-soft)" : undefined,
          }}
          onClick={() => update({ addPublicDetailsNow: false })}
        >
          Add later
          <span className="subtle small">Save as a draft</span>
        </button>
      </div>

      {state.addPublicDetailsNow ? (
        <div className="stack">
          <div className="field">
            <label className="field-label" htmlFor="public-title">
              Property title<span className="required">*</span>
            </label>
            <input
              id="public-title"
              className="input"
              value={state.title}
              maxLength={200}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Bright furnished double room in a shared house, Rusholme"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="public-description">
              Description<span className="required">*</span>
            </label>
            <textarea
              id="public-description"
              className="textarea"
              rows={7}
              value={state.description}
              onChange={(event) => update({ description: event.target.value })}
              placeholder="Describe the property naturally: the rooms, what is included, transport links and who it would suit."
            />
            <span className="field-hint">
              Photos are added on the property page once it is created.
            </span>
          </div>
        </div>
      ) : (
        <div className="alert alert--info">
          <span>
            The property will be saved as a <strong>draft</strong>. It will appear in Properties
            with a <em>Complete details</em> action, and cannot go on the website until the title,
            description and at least one photo are added.
          </span>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- step seven */

function StepReview({ state, isStudio }: { state: WizardState; isStudio: boolean }) {
  const missing: string[] = [];
  if (!state.addPublicDetailsNow) missing.push("Public title and description");
  missing.push("At least one photo");

  return (
    <div className="stack">
      <div>
        <h2>Review</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          Check everything before saving. You can edit any of it afterwards.
        </p>
      </div>

      <section className="stack--sm stack">
        <h3>Landlord</h3>
        <dl className="definition-list">
          <div>
            <dt>Name</dt>
            <dd>{state.landlordName || "-"}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="numeric">{state.landlordPhone || "-"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{state.landlordEmail || "Not provided"}</dd>
          </div>
        </dl>
      </section>

      <section className="stack--sm stack">
        <h3>Property</h3>
        <dl className="definition-list">
          <div>
            <dt>Address</dt>
            <dd>
              {[state.addressLine1, state.addressLine2, state.town, state.county, state.postcode]
                .filter(Boolean)
                .join(", ")}
            </dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>
              {state.propertyType === "SHARED"
                ? "Shared property"
                : state.category === "STUDIO_FLAT"
                  ? "Studio flat"
                  : state.category === "FLAT"
                    ? "Flat"
                    : "House"}
            </dd>
          </div>
          {state.propertyType === "FULL" && !isStudio && (
            <div>
              <dt>Rooms</dt>
              <dd>
                {state.availableRooms || 0} available of {state.numberOfRooms || 0}
              </dd>
            </div>
          )}
          <div>
            <dt>Features</dt>
            <dd>
              {FEATURES.filter((feature) => state.features[feature.key] === true)
                .map((feature) => feature.label)
                .join(", ") || "None recorded"}
            </dd>
          </div>
        </dl>
      </section>

      <section className="stack--sm stack">
        <h3>Financials</h3>
        {state.propertyType === "SHARED" ? (
          <RoomSummary rooms={state.rooms} />
        ) : (
          <dl className="definition-list">
            <div>
              <dt>Rent</dt>
              <dd>
                {formatGBP(state.rentPence)} pcm
                {state.rentPence !== null && (
                  <span className="subtle">
                    {" "}
                    (equivalent to {formatGBP(monthlyToWeeklyPence(state.rentPence))} pw)
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Deposit</dt>
              <dd>{formatGBP(state.depositPence)}</dd>
            </div>
            <div>
              <dt>Commission agreed</dt>
              <dd>
                {state.commissionValue === null
                  ? "-"
                  : state.commissionType === "PERCENTAGE"
                    ? `${state.commissionValue / 100}% of one month of rent`
                    : formatGBP(state.commissionValue)}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="stack--sm stack">
        <h3>Website listing</h3>
        <div className="row">
          <StatusBadge status={state.addPublicDetailsNow ? "READY_TO_PUBLISH" : "DRAFT"} />
        </div>
        <p className="muted small">
          Still needed before this can be published: {missing.join(", ")}.
        </p>
      </section>
    </div>
  );
}
