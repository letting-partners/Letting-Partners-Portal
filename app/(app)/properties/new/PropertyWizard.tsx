"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
  searchLandlordsAction,
  type LandlordMatch,
} from "./actions";

/**
 * Landlord and property onboarding.
 *
 * Seven steps, one screen at a time, with the whole form autosaved so a
 * refresh loses nothing. The landlord is committed at the end of step 1 - a
 * fronter who wins a landlord keeps the credit even if they stop there.
 */

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Whether step 1 creates a landlord or picks one already on the system. */
type LandlordMode = "NEW" | "EXISTING";

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
  doorNumber: string;
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
    doorNumber: "",
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

    rooms: [],

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
  const [landlordMode, setLandlordMode] = useState<LandlordMode>("NEW");
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

  /*
   * The number of available rooms is the source of truth for how many rooms
   * are described. Say two of the five bedrooms are free and two room cards
   * appear, already named, rather than the agent adding them by hand and
   * risking a count that disagrees with itself.
   *
   * Rooms already filled in are kept as they are: only the tail is added or
   * removed, so correcting three to four does not disturb the first three.
   */
  const syncRoomsToAvailability = useCallback((wanted: number, rooms: RoomDraft[]): RoomDraft[] => {
    if (wanted === rooms.length) return rooms;
    if (wanted < rooms.length) return rooms.slice(0, wanted);
    const next = [...rooms];
    while (next.length < wanted) next.push(emptyRoom(next.length));
    return next;
  }, []);

  /** Set the availability count and bring the room cards with it. */
  const setAvailableRooms = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "");
      const wanted = digits === "" ? 0 : Number(digits);

      setState((current) => {
        const next: WizardState = {
          ...current,
          availableRooms: digits,
          rooms:
            current.propertyType === "SHARED"
              ? syncRoomsToAvailability(wanted, current.rooms)
              : current.rooms,
        };
        save(next);
        return next;
      });
      setError(null);
    },
    [save, syncRoomsToAvailability],
  );

  /* ------------------------------------------------------------ step 1 */

  /** Adopt an existing landlord and move on - nothing to create. */
  function pickLandlord(landlord: LandlordMatch) {
    update({
      landlordId: landlord.id,
      landlordName: landlord.name,
      landlordPhone: landlord.phone,
    });
    toast.success(`${landlord.name} selected.`);
    setStep(2);
  }


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

  /* ------------------------------------------------------------ step 4 */

  function validateFeaturesStep(): string | null {
    if (!isStudio) {
      const total = Number(state.numberOfRooms);
      const available = Number(state.availableRooms);
      if (!total || total < 1) return "Enter how many bedrooms the property has.";
      if (state.availableRooms === "" || Number.isNaN(available)) {
        return "Enter how many bedrooms are available.";
      }
      if (available > total) {
        return "Available bedrooms cannot be more than the property has.";
      }
      if (state.propertyType === "SHARED" && available < 1) {
        return "A shared property needs at least one available room.";
      }
    }

    if (!isValidPostcode(state.postcode)) {
      return "Enter a valid UK postcode, for example M14 5AB.";
    }
    return null;
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

    if (!state.rentPence) return "Enter the monthly rent.";
    if (state.depositPence === null) return "Enter the deposit.";
    if (state.commissionValue === null) return "Enter the commission agreed with the landlord.";
    return null;
  }

  /* ------------------------------------------------------------ submit */

  function submitProperty() {
    const featuresError = validateFeaturesStep();
    if (featuresError) {
      setError(featuresError);
      setStep(4);
      return;
    }

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
        doorNumber: state.doorNumber || null,
        area: state.area || state.town || null,

        features: state.features as Record<string, boolean | null>,
        livingRoom: isStudio ? null : state.livingRoom,

        numberOfRooms: isStudio || !state.numberOfRooms ? null : Number(state.numberOfRooms),
        availableRooms: isStudio || state.availableRooms === "" ? null : Number(state.availableRooms),
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

  const canContinue = (() => {
    if (step === 1) return Boolean(state.landlordName.trim() && state.landlordPhone.trim());
    if (step === 2) return Boolean(state.addressLine1.trim() && state.postcode.trim());
    return true;
  })();

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
            <StepLandlord
              state={state}
              update={update}
              disabled={Boolean(state.landlordId)}
              mode={landlordMode}
              onModeChange={setLandlordMode}
              onPick={pickLandlord}
            />
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
          {step === 4 && (
            <StepFeatures
              state={state}
              update={update}
              isStudio={isStudio}
              setAvailableRooms={setAvailableRooms}
            />
          )}
          {step === 5 && <StepRent state={state} update={update} />}
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

              {step === 1 && !(landlordMode === "EXISTING" && !state.landlordId) && (
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
                    // Say why rather than disabling: a dead button leaves the
                    // agent hunting for the field that is wrong.
                    const stepError =
                      step === 4
                        ? validateFeaturesStep()
                        : step === 5
                          ? validateRentStep()
                          : null;

                    if (stepError) {
                      setError(stepError);
                      return;
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

function StepLandlord({
  state,
  update,
  disabled,
  mode,
  onModeChange,
  onPick,
}: StepProps & {
  disabled: boolean;
  mode: LandlordMode;
  onModeChange: (mode: LandlordMode) => void;
  onPick: (landlord: LandlordMatch) => void;
}) {
  return (
    <div className="stack">
      <div>
        <h2>Landlord</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          {mode === "EXISTING"
            ? "Find the landlord already on the system."
            : "The phone number becomes this landlord's permanent identity on the system."}
        </p>
      </div>

      {/* Adding a second property for a landlord already on the books is
          routine; without this the only route was to retype them and trip the
          duplicate check. */}
      {!disabled && (
        <div className="row row--wrap">
          <button
            type="button"
            className={mode === "NEW" ? "btn btn--primary" : "btn btn--secondary"}
            onClick={() => onModeChange("NEW")}
          >
            New landlord
          </button>
          <button
            type="button"
            className={mode === "EXISTING" ? "btn btn--primary" : "btn btn--secondary"}
            onClick={() => onModeChange("EXISTING")}
          >
            Existing landlord
          </button>
        </div>
      )}

      {mode === "EXISTING" && !disabled && <LandlordPicker onPick={onPick} />}

      {mode === "EXISTING" && !disabled ? null : (
        <>

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
        </>
      )}
    </div>
  );
}

/**
 * Type-ahead over the landlords the caller can see. Debounced so a fast typist
 * does not fire a query per keystroke, and last-response-wins so a slow early
 * query cannot overwrite the results of a later one.
 */
function LandlordPicker({ onPick }: { onPick: (landlord: LandlordMatch) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LandlordMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setSearching(true);
    const ticket = ++requestRef.current;

    const timer = setTimeout(async () => {
      const result = await searchLandlordsAction(term);
      if (ticket !== requestRef.current) return;

      setResults(result.ok ? result.data : []);
      setSearching(false);
      setSearched(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="stack--sm stack">
      <div className="field">
        <label className="field-label" htmlFor="landlord-search">
          Search by name or phone number
        </label>
        <input
          id="landlord-search"
          className="input"
          value={query}
          placeholder="Name or phone"
          onChange={(event) => setQuery(event.target.value)}
          autoFocus
        />
      </div>

      {searching && <p className="muted small">Searching...</p>}

      {!searching && searched && results.length === 0 && (
        <p className="muted small">
          No landlord matches that. Check the spelling, or add them as a new landlord.
        </p>
      )}

      {results.length > 0 && (
        <div className="stack--sm stack">
          {results.map((landlord) => (
            <button
              key={landlord.id}
              type="button"
              className="card card--selectable"
              onClick={() => onPick(landlord)}
            >
              <div className="card-body row row--between">
                <span>
                  <strong>{landlord.name}</strong>
                  <span className="muted small numeric" style={{ display: "block" }}>
                    {landlord.phone}
                  </span>
                </span>
                <span className="muted small">
                  {landlord.propertyCount === 1
                    ? "1 property"
                    : `${landlord.propertyCount} properties`}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
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

function StepFeatures({
  state,
  update,
  isStudio,
  setAvailableRooms,
}: StepProps & { isStudio: boolean; setAvailableRooms: (value: string) => void }) {
  const total = state.numberOfRooms === "" ? null : Number(state.numberOfRooms);
  const available = state.availableRooms === "" ? null : Number(state.availableRooms);
  const tooMany = total !== null && available !== null && available > total;

  return (
    <div className="stack">
      <div>
        <h2>Features</h2>
        <p className="muted small" style={{ marginTop: 3 }}>
          Leave anything you do not know unanswered - it can be filled in later.
        </p>
      </div>

      {!isStudio && (
        <div className="stack--sm stack">
          <h3 className="section-heading">Bedrooms</h3>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="rooms-total">
                How many bedrooms does it have?<span className="required">*</span>
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
                How many are available?<span className="required">*</span>
              </label>
              <input
                id="rooms-available"
                className="input"
                inputMode="numeric"
                value={state.availableRooms}
                onChange={(event) => setAvailableRooms(event.target.value)}
                aria-invalid={tooMany}
              />
              {tooMany && (
                <span className="field-error">
                  Available bedrooms cannot exceed the {total} in the property.
                </span>
              )}
            </div>
          </div>

          {state.propertyType === "SHARED" && available !== null && available > 0 && !tooMany && (
            <p className="muted small">
              {available === 1
                ? "One room to describe on the next step."
                : `${available} rooms to describe on the next step, ready and named.`}
            </p>
          )}
        </div>
      )}

      <div className="stack--sm stack">
        <h3 className="section-heading">Bathrooms</h3>
        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="bathrooms">
              How many bathrooms?
            </label>
            <input
              id="bathrooms"
              className="input"
              inputMode="numeric"
              value={state.bathrooms}
              onChange={(event) => update({ bathrooms: event.target.value.replace(/\D/g, "") })}
            />
          </div>
        </div>
      </div>

      <div className="stack--sm stack">
        <h3 className="section-heading">The property</h3>

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

      {/*
        The postcode is asked for again at the end deliberately. On a call the
        agent often has only the outward code early on; this is where the full
        one, and the door number, get pinned down.
      */}
      <div className="stack--sm stack">
        <h3 className="section-heading">Exact location</h3>

        <div className="form-grid">
          <div className="field">
            <label className="field-label" htmlFor="features-postcode">
              Full postcode<span className="required">*</span>
            </label>
            <input
              id="features-postcode"
              className="input"
              value={state.postcode}
              onChange={(event) => update({ postcode: event.target.value.toUpperCase() })}
              aria-invalid={state.postcode !== "" && !isValidPostcode(state.postcode)}
            />
            {state.postcode !== "" && !isValidPostcode(state.postcode) && (
              <span className="field-error">Enter a valid UK postcode, for example M14 5AB.</span>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="features-door">
              Flat or door number
            </label>
            <input
              id="features-door"
              className="input"
              value={state.doorNumber}
              onChange={(event) => update({ doorNumber: event.target.value })}
              placeholder="Optional"
            />
            <span className="field-hint">
              Leave blank if the landlord has not given it - you can add it later.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ step five */

function StepRent({ state, update }: StepProps) {
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

  /*
   * Adding or removing a room here moves the availability count with it. The
   * count and the list are the same fact stated twice, and a listing that says
   * two rooms free while describing three is worse than either answer alone.
   */
  function setRooms(rooms: RoomDraft[]) {
    update({ rooms, availableRooms: String(rooms.length) });
  }

  return (
    <div className="stack">
      <div className="row row--between">
        <div>
          <h2>Rooms</h2>
          <p className="muted small" style={{ marginTop: 3 }}>
            {state.rooms.length === 1
              ? "One room, from the availability you entered. Rent, deposit and availability are set per room."
              : `${state.rooms.length} rooms, from the availability you entered. Rent, deposit and availability are set per room.`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => setRooms([...state.rooms, emptyRoom(state.rooms.length)])}
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
                    setRooms([
                      ...state.rooms,
                      { ...room, key: `room-${Date.now()}`, name: `${room.name} (copy)` },
                    ])
                  }
                >
                  <Copy size={13} />
                  Duplicate
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={state.rooms.length === 1}
                  onClick={() => setRooms(state.rooms.filter((item) => item.key !== room.key))}
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
              maxLength={60}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Bright double room in a shared house, Ilford"
            />
            <span className="field-hint">
              {state.title.length}/60 characters. This becomes the search result title.
            </span>
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
            <dt>Flat or door number</dt>
            <dd>{state.doorNumber || "Not provided"}</dd>
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
          {!isStudio && (
            <div>
              <dt>Bedrooms</dt>
              <dd>
                {state.availableRooms || 0} available of {state.numberOfRooms || 0}
              </dd>
            </div>
          )}
          {state.bathrooms !== "" && (
            <div>
              <dt>Bathrooms</dt>
              <dd>{state.bathrooms}</dd>
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
