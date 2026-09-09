"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { createTenantAction } from "./actions";

/**
 * Register an applicant. Used both from the Tenants page and inline when an
 * agent starts a viewing for someone who is not on the system yet.
 */
export default function TenantForm({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: (tenantId: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [area, setArea] = useState("");
  const [postcodes, setPostcodes] = useState("");
  const [requirements, setRequirements] = useState("");
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [moveInDate, setMoveInDate] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [roomType, setRoomType] = useState("");
  const [occupants, setOccupants] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState<number | null>(null);
  const [occupation, setOccupation] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [typePreference, setTypePreference] = useState("");

  function reset() {
    setName("");
    setEmail("");
    setPhone("");
    setArea("");
    setPostcodes("");
    setRequirements("");
    setMinBudget(null);
    setMaxBudget(null);
    setMoveInDate("");
    setBedrooms("");
    setTypePreference("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createTenantAction({
        name,
        email: email || null,
        phone,
        area: area || null,
        postcodePreferences: postcodes || null,
        requirements: requirements || null,
        minBudgetPence: minBudget,
        maxBudgetPence: maxBudget,
        moveInDate: moveInDate || null,
        bedrooms: bedrooms ? Number(bedrooms) : null,
        roomType: roomType || null,
        occupants: occupants || null,
        monthlyIncomePence: monthlyIncome,
        occupation: occupation || null,
        countryOfOrigin: countryOfOrigin || null,
        propertyTypePreference: (typePreference || null) as
          | "HOUSE"
          | "FLAT"
          | "STUDIO_FLAT"
          | null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      toast.success("Tenant registered.");
      setOpen(false);
      reset();
      onCreated?.(result.data.tenantId);
      router.refresh();
    });
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register a tenant"
        description="Applicants belong to the agent who registers them."
        wide
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
              disabled={pending || !name.trim() || !phone.trim()}
            >
              {pending && <span className="spinner" aria-hidden="true" />}
              Register tenant
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

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="tenant-name">
                Name<span className="required">*</span>
              </label>
              <input
                id="tenant-name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-phone">
                Phone number<span className="required">*</span>
              </label>
              <input
                id="tenant-phone"
                className="input numeric"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-email">
                Email
              </label>
              <input
                id="tenant-email"
                type="email"
                className="input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-area">
                Area
              </label>
              <input
                id="tenant-area"
                className="input"
                value={area}
                placeholder="Manchester"
                onChange={(event) => setArea(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-postcodes">
                Postcode preferences
              </label>
              <input
                id="tenant-postcodes"
                className="input"
                value={postcodes}
                placeholder="M14, M13, M20"
                onChange={(event) => setPostcodes(event.target.value)}
              />
              <span className="field-hint">Outward codes, separated by commas.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-movein">
                Move in date
              </label>
              <input
                id="tenant-movein"
                type="date"
                className="input"
                value={moveInDate}
                onChange={(event) => setMoveInDate(event.target.value)}
              />
            </div>

            <MoneyInput
              label="Minimum budget"
              value={minBudget}
              onChange={setMinBudget}
              hint="Per month"
            />

            <MoneyInput
              label="Maximum budget"
              value={maxBudget}
              onChange={setMaxBudget}
              hint="Per month"
            />

            <div className="field">
              <label className="field-label" htmlFor="tenant-room-type">
                Room type
              </label>
              <select
                id="tenant-room-type"
                className="select"
                value={roomType}
                onChange={(event) => setRoomType(event.target.value)}
              >
                <option value="">Not specified</option>
                <option value="Single room">Single room</option>
                <option value="Double room">Double room</option>
                <option value="En-suite room">En-suite room</option>
                <option value="Master room">Master room</option>
                <option value="Twin room">Twin room</option>
                <option value="Studio">Studio</option>
                <option value="Whole property">Whole property</option>
              </select>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-occupants">
                Number of people
              </label>
              <input
                id="tenant-occupants"
                className="input"
                value={occupants}
                placeholder="e.g. 2 adults and a child"
                onChange={(event) => setOccupants(event.target.value)}
              />
            </div>

            <MoneyInput
              label="Monthly income"
              value={monthlyIncome}
              onChange={setMonthlyIncome}
              hint="Take home, per month"
            />

            <div className="field">
              <label className="field-label" htmlFor="tenant-occupation">
                Occupation
              </label>
              <input
                id="tenant-occupation"
                className="input"
                value={occupation}
                onChange={(event) => setOccupation(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-country">
                Country of origin
              </label>
              <input
                id="tenant-country"
                className="input"
                value={countryOfOrigin}
                onChange={(event) => setCountryOfOrigin(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-bedrooms">
                Bedrooms
              </label>
              <input
                id="tenant-bedrooms"
                className="input"
                inputMode="numeric"
                value={bedrooms}
                onChange={(event) => setBedrooms(event.target.value.replace(/\D/g, ""))}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="tenant-type">
                Property type preference
              </label>
              <select
                id="tenant-type"
                className="select"
                value={typePreference}
                onChange={(event) => setTypePreference(event.target.value)}
              >
                <option value="">No preference</option>
                <option value="HOUSE">House</option>
                <option value="FLAT">Flat</option>
                <option value="STUDIO_FLAT">Studio flat</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="tenant-requirements">
              Requirements
            </label>
            <textarea
              id="tenant-requirements"
              className="textarea"
              rows={3}
              value={requirements}
              placeholder="What are they looking for? Anything that would rule a property in or out."
              onChange={(event) => setRequirements(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
