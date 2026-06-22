"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { MediaLibraryPicker, type MediaSelectionValue } from "@/components/media-library-picker";
import { calculateRentPerWeek, normalizePostcode } from "@/lib/normalize";
import { UppercasePostcodeInput } from "@/components/portal/UppercasePostcodeInput";
import { PropertyRoomEditor, type PropertyRoomDraft } from "@/components/portal/PropertyRoomEditor";
import type { PropertyStatus } from "@/lib/portal-api";

export type PropertyFormValues = {
  title: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  propertyCategory: "PRIVATE" | "SHARED";
  propertyType: string;
  rentPerMonth: string;
  depositAmount: string;
  availabilityDate: string;
  initialStatus: PropertyStatus;
  isFurnished: boolean;
  petsAllowed: boolean;
  dssAllowed: boolean;
  childrenAllowed: boolean;
  livingLandlord: boolean;
  personsAllowed: string;
  totalRooms: string;
  availableRooms: string;
  propertyRef: string;
  rooms: PropertyRoomDraft[];
  mediaAssets: MediaSelectionValue[];
};

export type PropertyFormSubmitValues = PropertyFormValues & {
  postcode: string;
  rentPerWeek: number | null;
  rooms: Array<PropertyRoomDraft & { rentPerWeek: number | null }>;
};

type Props = {
  title?: string;
  description?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  propertyReference?: string | null;
  landlordSummary?: string | null;
  initialValue?: Partial<PropertyFormValues>;
  onSubmit: (values: PropertyFormSubmitValues) => void | Promise<void>;
  onCancel?: () => void;
};

const DEFAULT_VALUES: PropertyFormValues = {
  title: "",
  description: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
  propertyCategory: "PRIVATE",
  propertyType: "House",
  rentPerMonth: "",
  depositAmount: "",
  availabilityDate: "",
  initialStatus: "DRAFT",
  isFurnished: true,
  petsAllowed: true,
  dssAllowed: true,
  childrenAllowed: true,
  livingLandlord: false,
  personsAllowed: "",
  totalRooms: "",
  availableRooms: "",
  propertyRef: "",
  rooms: [
    {
      roomName: "Studio Room",
      rentPerMonth: "",
      expectedCommissionPct: "",
    },
  ],
  mediaAssets: [],
};

const PRIVATE_PROPERTY_TYPES = ["House", "Flat", "Studio Flat", "Maisonette"] as const;

function createInitialValue(initialValue?: Partial<PropertyFormValues>): PropertyFormValues {
  return {
    ...DEFAULT_VALUES,
    ...initialValue,
    postcode: normalizePostcode(initialValue?.postcode ?? ""),
    mediaAssets: initialValue?.mediaAssets ?? DEFAULT_VALUES.mediaAssets,
    rooms: initialValue?.rooms ?? DEFAULT_VALUES.rooms,
  };
}

export function PropertyForm({
  title = "Property Details",
  description,
  submitLabel = "Save Property",
  busy = false,
  disabled = false,
  propertyReference,
  landlordSummary,
  initialValue,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState<PropertyFormValues>(() => createInitialValue(initialValue));

  useEffect(() => {
    setValue(createInitialValue(initialValue));
  }, [
    initialValue?.title,
    initialValue?.description,
    initialValue?.addressLine1,
    initialValue?.addressLine2,
    initialValue?.city,
    initialValue?.county,
    initialValue?.postcode,
    initialValue?.propertyCategory,
    initialValue?.propertyType,
    initialValue?.rentPerMonth,
    initialValue?.depositAmount,
    initialValue?.availabilityDate,
    initialValue?.initialStatus,
    initialValue?.isFurnished,
    initialValue?.petsAllowed,
    initialValue?.dssAllowed,
    initialValue?.childrenAllowed,
    initialValue?.livingLandlord,
    initialValue?.personsAllowed,
    initialValue?.totalRooms,
    initialValue?.availableRooms,
    initialValue?.propertyRef,
    initialValue?.rooms,
    initialValue?.mediaAssets,
  ]);

  const weeklyRent = useMemo(() => calculateRentPerWeek(value.rentPerMonth), [value.rentPerMonth]);

  function updateRoom(index: number, nextRoom: PropertyRoomDraft) {
    setValue((current) => ({
      ...current,
      rooms: current.rooms.map((room, roomIndex) => (roomIndex === index ? nextRoom : room)),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: PropertyFormSubmitValues = {
      ...value,
      postcode: normalizePostcode(value.postcode),
      rentPerWeek: calculateRentPerWeek(value.rentPerMonth),
      rooms: value.rooms.map((room) => ({
        ...room,
        rentPerWeek: calculateRentPerWeek(room.rentPerMonth),
      })),
    };

    await onSubmit(payload);
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <div className="stack" style={{ gap: "0.35rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>{title}</h2>
        {description ? <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.84rem" }}>{description}</p> : null}
        {landlordSummary ? (
          <div style={{ color: "var(--brand-gold)", fontSize: "0.82rem", fontWeight: 600 }}>
            Landlord: {landlordSummary}
          </div>
        ) : null}
        <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
          Property reference: {propertyReference?.trim() ? propertyReference : "Generated automatically on save"}
        </div>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Property Category</span>
          <UISelect
            value={value.propertyCategory}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                propertyCategory: event.target.value as PropertyFormValues["propertyCategory"],
              }))
            }
            disabled={busy || disabled}
          >
            <option value="PRIVATE">Private Property</option>
            <option value="SHARED">Shared Property</option>
          </UISelect>
        </label>

        <label className="field">
          <span className="label">Initial Status</span>
          <UISelect
            value={value.initialStatus}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                initialStatus: event.target.value as PropertyStatus,
              }))
            }
            disabled={busy || disabled}
          >
            <option value="DRAFT">Draft</option>
            <option value="AVAILABLE">Available</option>
          </UISelect>
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Title</span>
          <UIInput
            value={value.title}
            onChange={(event) => setValue((current) => ({ ...current, title: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Bright 3-bed family home"
          />
        </label>

        <label className="field">
          <span className="label">Property Type</span>
          {value.propertyCategory === "PRIVATE" ? (
            <UISelect
              value={value.propertyType}
              onChange={(event) => setValue((current) => ({ ...current, propertyType: event.target.value }))}
              disabled={busy || disabled}
            >
              {PRIVATE_PROPERTY_TYPES.map((propertyType) => (
                <option key={propertyType} value={propertyType}>
                  {propertyType}
                </option>
              ))}
            </UISelect>
          ) : (
            <UIInput
              value={value.propertyType}
              onChange={(event) => setValue((current) => ({ ...current, propertyType: event.target.value }))}
              disabled={busy || disabled}
              placeholder="Optional description"
            />
          )}
        </label>
      </div>

      <label className="field">
        <span className="label">Description</span>
        <textarea
          className="textarea"
          value={value.description}
          onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}
          disabled={busy || disabled}
          rows={5}
          placeholder="Describe the property, layout, and key selling points."
        />
      </label>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Address Line 1</span>
          <UIInput
            value={value.addressLine1}
            onChange={(event) => setValue((current) => ({ ...current, addressLine1: event.target.value }))}
            disabled={busy || disabled}
            placeholder="123 High Street"
          />
        </label>

        <label className="field">
          <span className="label">Address Line 2</span>
          <UIInput
            value={value.addressLine2}
            onChange={(event) => setValue((current) => ({ ...current, addressLine2: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Flat 2B"
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">City</span>
          <UIInput
            value={value.city}
            onChange={(event) => setValue((current) => ({ ...current, city: event.target.value }))}
            disabled={busy || disabled}
            placeholder="London"
          />
        </label>

        <label className="field">
          <span className="label">County</span>
          <UIInput
            value={value.county}
            onChange={(event) => setValue((current) => ({ ...current, county: event.target.value }))}
            disabled={busy || disabled}
            placeholder="Greater London"
          />
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Postcode</span>
          <UppercasePostcodeInput
            value={value.postcode}
            onChange={(nextValue) => setValue((current) => ({ ...current, postcode: nextValue }))}
            disabled={busy || disabled}
            placeholder="SW1A 1AA"
          />
        </label>

        <label className="field">
          <span className="label">Availability Date</span>
          <UIInput
            type="date"
            value={value.availabilityDate}
            onChange={(event) => setValue((current) => ({ ...current, availabilityDate: event.target.value }))}
            disabled={busy || disabled}
          />
        </label>
      </div>

      {value.propertyCategory === "PRIVATE" ? (
        <>
          <div className="field-grid-2">
            <label className="field">
              <span className="label">Rent / Month (£)</span>
              <UIInput
                type="number"
                min={0}
                step="0.01"
                value={value.rentPerMonth}
                onChange={(event) => setValue((current) => ({ ...current, rentPerMonth: event.target.value }))}
                disabled={busy || disabled}
                placeholder="e.g. 1200"
              />
            </label>

            <label className="field">
              <span className="label">Rent / Week</span>
              <div className="input" style={{ display: "flex", alignItems: "center", minHeight: 42 }}>
                {weeklyRent == null ? "—" : `£${weeklyRent.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </div>
            </label>
          </div>

          <div className="field-grid-2">
            <label className="field">
              <span className="label">Deposit (£)</span>
              <UIInput
                type="number"
                min={0}
                step="0.01"
                value={value.depositAmount}
                onChange={(event) => setValue((current) => ({ ...current, depositAmount: event.target.value }))}
                disabled={busy || disabled}
                placeholder="e.g. 1500"
              />
            </label>

            <label className="field">
              <span className="label">Persons Allowed</span>
              <UIInput
                type="number"
                min={1}
                step="1"
                value={value.personsAllowed}
                onChange={(event) => setValue((current) => ({ ...current, personsAllowed: event.target.value }))}
                disabled={busy || disabled}
                placeholder="e.g. 4"
              />
            </label>
          </div>
        </>
      ) : (
        <div className="stack">
          <div className="field-grid-2">
            <label className="field">
              <span className="label">Total Rooms</span>
              <UIInput
                type="number"
                min={0}
                step="1"
                value={value.totalRooms}
                onChange={(event) => setValue((current) => ({ ...current, totalRooms: event.target.value }))}
                disabled={busy || disabled}
                placeholder="e.g. 4"
              />
            </label>

            <label className="field">
              <span className="label">Available Rooms</span>
              <UIInput
                type="number"
                min={0}
                step="1"
                value={value.availableRooms}
                onChange={(event) => setValue((current) => ({ ...current, availableRooms: event.target.value }))}
                disabled={busy || disabled}
                placeholder="e.g. 2"
              />
            </label>
          </div>

          <div className="field-grid-2">
            <label className="field">
              <span className="label">Deposit (£)</span>
              <UIInput
                type="number"
                min={0}
                step="0.01"
                value={value.depositAmount}
                onChange={(event) => setValue((current) => ({ ...current, depositAmount: event.target.value }))}
                disabled={busy || disabled}
                placeholder="Optional"
              />
            </label>

            <label className="field">
              <span className="label">Persons Allowed</span>
              <UIInput
                type="number"
                min={1}
                step="1"
                value={value.personsAllowed}
                onChange={(event) => setValue((current) => ({ ...current, personsAllowed: event.target.value }))}
                disabled={busy || disabled}
                placeholder="Optional"
              />
            </label>
          </div>

          <PropertyRoomEditor
            value={value.rooms}
            onChange={(rooms) => setValue((current) => ({ ...current, rooms }))}
            disabled={busy || disabled}
          />
        </div>
      )}

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Furnished</span>
          <UISelect
            value={value.isFurnished ? "yes" : "no"}
            onChange={(event) => setValue((current) => ({ ...current, isFurnished: event.target.value === "yes" }))}
            disabled={busy || disabled}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </UISelect>
        </label>

        <label className="field">
          <span className="label">Living Landlord</span>
          <UISelect
            value={value.livingLandlord ? "yes" : "no"}
            onChange={(event) => setValue((current) => ({ ...current, livingLandlord: event.target.value === "yes" }))}
            disabled={busy || disabled}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </UISelect>
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Pets Allowed</span>
          <UISelect
            value={value.petsAllowed ? "yes" : "no"}
            onChange={(event) => setValue((current) => ({ ...current, petsAllowed: event.target.value === "yes" }))}
            disabled={busy || disabled}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </UISelect>
        </label>

        <label className="field">
          <span className="label">DSS Allowed</span>
          <UISelect
            value={value.dssAllowed ? "yes" : "no"}
            onChange={(event) => setValue((current) => ({ ...current, dssAllowed: event.target.value === "yes" }))}
            disabled={busy || disabled}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </UISelect>
        </label>
      </div>

      <div className="field-grid-2">
        <label className="field">
          <span className="label">Children Allowed</span>
          <UISelect
            value={value.childrenAllowed ? "yes" : "no"}
            onChange={(event) => setValue((current) => ({ ...current, childrenAllowed: event.target.value === "yes" }))}
            disabled={busy || disabled}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </UISelect>
        </label>

        <label className="field">
          <span className="label">Property Reference</span>
          <UIInput
            value={value.propertyRef}
            onChange={(event) => setValue((current) => ({ ...current, propertyRef: event.target.value }))}
            disabled={busy || disabled}
            placeholder={propertyReference?.trim() ? propertyReference : "Generated automatically"}
            readOnly={Boolean(propertyReference?.trim())}
          />
        </label>
      </div>

      <div className="field">
        <MediaLibraryPicker
          selectedAssets={value.mediaAssets}
          onChange={(mediaAssets) => setValue((current) => ({ ...current, mediaAssets }))}
          disabled={busy || disabled}
          label="Property Photos"
        />
      </div>

      <div className="inline-row" style={{ marginTop: "0.25rem" }}>
        <UIButton type="submit" disabled={busy || disabled}>
          {busy ? "Saving..." : submitLabel}
        </UIButton>
        {onCancel ? (
          <UIButton type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </UIButton>
        ) : null}
      </div>
    </form>
  );
}