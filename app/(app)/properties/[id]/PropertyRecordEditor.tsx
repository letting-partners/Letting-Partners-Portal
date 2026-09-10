"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useToast } from "@/components/ui/Toast";
import { updateFullPropertyAction } from "../actions";

/**
 * Admin edit of the whole property record.
 *
 * The ordinary screens are narrow on purpose - publish, public details, rooms -
 * because each carries its own rule. This is the correction path for when the
 * record is simply wrong, so it shows everything at once and trusts the admin.
 *
 * Every change is audited with its before and after value, and the money
 * fields carry a warning rather than a block: commission is snapshotted when a
 * deal closes, so editing it here changes what the record says, not what has
 * already been calculated against it.
 */

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

export type PropertyRecord = {
  id: string;
  reference: string;
  propertyType: string;
  category: string | null;
  addressLine1: string;
  addressLine2: string | null;
  doorNumber: string | null;
  town: string | null;
  county: string | null;
  postcode: string;
  area: string | null;
  livingRoom: string | null;
  numberOfRooms: number | null;
  availableRooms: number | null;
  bathrooms: number | null;
  availabilityDate: string | null;
  rentPerMonthPence: number | null;
  depositPence: number | null;
  commissionType: string | null;
  commissionValue: number | null;
  title: string | null;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  features: Record<string, boolean | null>;
  hasClosedSale: boolean;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

export default function PropertyRecordEditor({ property }: { property: PropertyRecord }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState({
    propertyType: property.propertyType,
    category: property.category ?? "",
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2 ?? "",
    doorNumber: property.doorNumber ?? "",
    town: property.town ?? "",
    county: property.county ?? "",
    postcode: property.postcode,
    area: property.area ?? "",
    livingRoom: property.livingRoom ?? "",
    numberOfRooms: property.numberOfRooms?.toString() ?? "",
    availableRooms: property.availableRooms?.toString() ?? "",
    bathrooms: property.bathrooms?.toString() ?? "",
    availabilityDate: property.availabilityDate ?? "",
    commissionType: property.commissionType ?? "PERCENTAGE",
    title: property.title ?? "",
    description: property.description ?? "",
    metaTitle: property.metaTitle ?? "",
    metaDescription: property.metaDescription ?? "",
  });

  const [rent, setRent] = useState<number | null>(property.rentPerMonthPence);
  const [deposit, setDeposit] = useState<number | null>(property.depositPence);
  const [commissionValue, setCommissionValue] = useState(
    property.commissionValue?.toString() ?? "",
  );
  const [features, setFeatures] = useState<Record<string, boolean | null>>(property.features);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateFullPropertyAction({
        propertyId: property.id,
        propertyType: form.propertyType as "FULL" | "SHARED",
        category: (form.category || null) as "HOUSE" | "FLAT" | "STUDIO_FLAT" | null,

        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2 || null,
        doorNumber: form.doorNumber || null,
        town: form.town || null,
        county: form.county || null,
        postcode: form.postcode,
        area: form.area || null,

        features,
        livingRoom: (form.livingRoom || null) as "SHARED" | "PRIVATE" | "NONE" | null,

        numberOfRooms: form.numberOfRooms ? Number(form.numberOfRooms) : null,
        availableRooms: form.availableRooms ? Number(form.availableRooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        availabilityDate: form.availabilityDate || null,

        rentPerMonthPence: rent,
        depositPence: deposit,
        commissionType: (form.commissionType || null) as "PERCENTAGE" | "FIXED" | null,
        commissionValue: commissionValue ? Number(commissionValue) : null,

        title: form.title || null,
        description: form.description || null,
        metaTitle: form.metaTitle || null,
        metaDescription: form.metaDescription || null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Property updated.");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="alert alert--warning">
        <AlertTriangle size={16} />
        <span>
          Every field on the record, editable. Changes are audited with their previous value.
          {property.hasClosedSale && (
            <>
              {" "}
              <strong>
                This property has a completed sale. Commission was calculated at closing and
                editing these figures will not recalculate it.
              </strong>
            </>
          )}
        </span>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Type and address</span>
        </div>
        <div className="card-body form-grid">
          <div className="field">
            <label className="field-label" htmlFor="pe-type">
              Property type
            </label>
            <select
              id="pe-type"
              className="select"
              value={form.propertyType}
              onChange={(event) => set("propertyType", event.target.value)}
            >
              <option value="FULL">Whole property</option>
              <option value="SHARED">Shared property</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-category">
              Category
            </label>
            <select
              id="pe-category"
              className="select"
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              <option value="">Not set</option>
              <option value="HOUSE">House</option>
              <option value="FLAT">Flat</option>
              <option value="STUDIO_FLAT">Studio flat</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-line1">
              Address line 1
            </label>
            <input
              id="pe-line1"
              className="input"
              value={form.addressLine1}
              onChange={(event) => set("addressLine1", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-line2">
              Address line 2
            </label>
            <input
              id="pe-line2"
              className="input"
              value={form.addressLine2}
              onChange={(event) => set("addressLine2", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-door">
              Flat or door number
            </label>
            <input
              id="pe-door"
              className="input"
              value={form.doorNumber}
              onChange={(event) => set("doorNumber", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-town">
              Town
            </label>
            <input
              id="pe-town"
              className="input"
              value={form.town}
              onChange={(event) => set("town", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-county">
              County
            </label>
            <input
              id="pe-county"
              className="input"
              value={form.county}
              onChange={(event) => set("county", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-postcode">
              Postcode
            </label>
            <input
              id="pe-postcode"
              className="input"
              value={form.postcode}
              onChange={(event) => set("postcode", event.target.value.toUpperCase())}
            />
            <span className="field-hint">
              Changing this rebuilds the outward code and the formatted address.
            </span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-area">
              Area
            </label>
            <input
              id="pe-area"
              className="input"
              value={form.area}
              onChange={(event) => set("area", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Size and availability</span>
        </div>
        <div className="card-body form-grid">
          <div className="field">
            <label className="field-label" htmlFor="pe-rooms">
              Bedrooms
            </label>
            <input
              id="pe-rooms"
              className="input"
              inputMode="numeric"
              value={form.numberOfRooms}
              onChange={(event) => set("numberOfRooms", digits(event.target.value))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-available">
              Bedrooms available
            </label>
            <input
              id="pe-available"
              className="input"
              inputMode="numeric"
              value={form.availableRooms}
              onChange={(event) => set("availableRooms", digits(event.target.value))}
            />
            <span className="field-hint">Cannot exceed the number of bedrooms.</span>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-baths">
              Bathrooms
            </label>
            <input
              id="pe-baths"
              className="input"
              inputMode="numeric"
              value={form.bathrooms}
              onChange={(event) => set("bathrooms", digits(event.target.value))}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-available-from">
              Availability date
            </label>
            <input
              id="pe-available-from"
              type="date"
              className="input"
              value={form.availabilityDate}
              onChange={(event) => set("availabilityDate", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-living">
              Living room
            </label>
            <select
              id="pe-living"
              className="select"
              value={form.livingRoom}
              onChange={(event) => set("livingRoom", event.target.value)}
            >
              <option value="">Not set</option>
              <option value="PRIVATE">Private</option>
              <option value="SHARED">Shared</option>
              <option value="NONE">None</option>
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Money</span>
        </div>
        <div className="card-body form-grid">
          <MoneyInput label="Rent per month" value={rent} onChange={setRent} />
          <MoneyInput label="Deposit" value={deposit} onChange={setDeposit} />

          <div className="field">
            <label className="field-label" htmlFor="pe-commission-type">
              Commission type
            </label>
            <select
              id="pe-commission-type"
              className="select"
              value={form.commissionType}
              onChange={(event) => set("commissionType", event.target.value)}
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-commission-value">
              Commission value
            </label>
            <input
              id="pe-commission-value"
              className="input"
              inputMode="numeric"
              value={commissionValue}
              onChange={(event) => setCommissionValue(digits(event.target.value))}
            />
            <span className="field-hint">
              {form.commissionType === "PERCENTAGE"
                ? "Basis points: 1000 is 10%."
                : "Pence: 50000 is £500."}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Features</span>
        </div>
        <div className="card-body stack--sm stack">
          {FEATURES.map((feature) => {
            const value = features[feature.key] ?? null;
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
                      setFeatures((f) => ({ ...f, [feature.key]: value === true ? null : true }))
                    }
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    data-tone="no"
                    aria-pressed={value === false}
                    onClick={() =>
                      setFeatures((f) => ({ ...f, [feature.key]: value === false ? null : false }))
                    }
                  >
                    No
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Listing and search</span>
        </div>
        <div className="card-body form-grid">
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label" htmlFor="pe-title">
              Public title
            </label>
            <input
              id="pe-title"
              className="input"
              maxLength={60}
              value={form.title}
              onChange={(event) => set("title", event.target.value)}
            />
            <span className="field-hint">{form.title.length}/60 characters.</span>
          </div>

          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label" htmlFor="pe-description">
              Description
            </label>
            <textarea
              id="pe-description"
              className="input"
              rows={6}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-meta-title">
              SEO title
            </label>
            <input
              id="pe-meta-title"
              className="input"
              value={form.metaTitle}
              onChange={(event) => set("metaTitle", event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="pe-meta-description">
              Meta description
            </label>
            <textarea
              id="pe-meta-description"
              className="input"
              rows={3}
              value={form.metaDescription}
              onChange={(event) => set("metaDescription", event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row">
        <button type="button" className="btn btn--primary" onClick={save} disabled={pending}>
          {pending && <span className="spinner" aria-hidden="true" />}
          <Save size={15} />
          Save all changes
        </button>
      </div>
    </div>
  );
}
