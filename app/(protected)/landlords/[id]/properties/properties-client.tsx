"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import {
  closePropertySale,
  closePropertyRoomSale,
  createLandlordProperty,
  fetchLandlordProperties,
  updateProperty,
  type PropertyRow,
  type PropertyStatus,
  type SessionRole,
  type VacancyType,
} from "@/lib/portal-api";

type Props = {
  landlordId: string;
  currentRole: SessionRole;
};

type CloseSaleForm = {
  propertyId: string;
  roomId?: string;
  roomName?: string;
  finalAmount: string;
  commissionType: "pct" | "amt";
  commissionPct: string;
  commissionAmt: string;
  otherCosts: string;
  tenantFirstName: string;
  tenantLastName: string;
  tenantEmail: string;
  tenantPhone: string;
  tenantAddress: string;
  tenantMoveInDate: string;
  tenantRent: string;
  tenantDeposit: string;
  tenantNotes: string;
  tenantAccommodationType: "PRIVATE" | "SHARED" | "";
  tenantRoomType: string;
  tenantNationality: string;
  tenantCountryOriginal: string;
  tenantNumOccupants: string;
  tenantNumChildren: string;
  tenantOnDSS: boolean;
  tenantEmployed: boolean;
  tenantAnnualIncome: string;
  tenantCurrentPostcode: string;
  tenantWorkplacePostcode: string;
  tenantMaxBudget: string;
  tenantProfession: string;
  tenantImmigrationStatus: string;
};

type RoomDraft = {
  roomName: string;
  landlordDemand: string;
  expectedCommissionPct: string;
};

const ROOM_TYPES = [
  "Studio Room",
  "Single Room",
  "Double Room",
  "Ensuite Room",
  "Loft",
] as const;

function createEmptyRoom(): RoomDraft {
  return {
    roomName: ROOM_TYPES[0],
    landlordDemand: "",
    expectedCommissionPct: "",
  };
}

function getSales(property: PropertyRow) {
  return property.sales ?? (property.sale ? [property.sale] : []);
}

function roomStatusBadge(status: "AVAILABLE" | "UNDER_OFFER" | "CLOSED") {
  if (status === "AVAILABLE") return "badge-active";
  if (status === "UNDER_OFFER") return "badge-offer";
  return "badge-sold";
}

const STATUS_CONFIG: Record<PropertyStatus, { label: string; badgeClass: string }> = {
  AVAILABLE: { label: "Available", badgeClass: "badge-active" },
  CLOSED:    { label: "Closed",    badgeClass: "badge-sold"   },
  DRAFT:     { label: "Draft",     badgeClass: "badge-draft"  },
};

export function LandlordPropertiesClient({ landlordId, currentRole }: Props) {
  const [landlordLabel, setLandlordLabel] = useState("");
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const [newPropertyRef, setNewPropertyRef] = useState("");
  const [newAddressLine1, setNewAddressLine1] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPostcode, setNewPostcode] = useState("");
  const [newDemand, setNewDemand] = useState("");
  const [newStatus, setNewStatus] = useState<PropertyStatus>("DRAFT");
  const [newVacancyType, setNewVacancyType] = useState<VacancyType>("SINGLE");
  const [newTotalRooms, setNewTotalRooms] = useState("");
  const [newAvailableRooms, setNewAvailableRooms] = useState("");
  const [newRentPerMonth, setNewRentPerMonth] = useState("");
  const [newDepositAmount, setNewDepositAmount] = useState("");
  const [newIsFurnished, setNewIsFurnished] = useState<"true" | "false">("true");
  const [newPersonsAllowed, setNewPersonsAllowed] = useState("");
  const [newPetsAllowed, setNewPetsAllowed] = useState<"true" | "false">("true");
  const [newDssAllowed, setNewDssAllowed] = useState<"true" | "false">("true");
  const [newChildrenAllowed, setNewChildrenAllowed] = useState<"true" | "false">("true");
  const [newAvailabilityDate, setNewAvailabilityDate] = useState("");
  const [newLivingLandlord, setNewLivingLandlord] = useState<"true" | "false">("false");
  const [newRooms, setNewRooms] = useState<RoomDraft[]>([createEmptyRoom()]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editPropertyRef, setEditPropertyRef] = useState("");
  const [editStatus, setEditStatus] = useState<PropertyStatus>("DRAFT");
  const [editAddressLine1, setEditAddressLine1] = useState("");
  const [editAddressLine2, setEditAddressLine2] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCounty, setEditCounty] = useState("");
  const [editPostcode, setEditPostcode] = useState("");
  const [editDemand, setEditDemand] = useState("");
  const [editCommissionType, setEditCommissionType] = useState<"pct" | "amt">("pct");
  const [editCommissionPct, setEditCommissionPct] = useState("");
  const [editCommissionAmt, setEditCommissionAmt] = useState("");
  const [editTotalRooms, setEditTotalRooms] = useState("");
  const [editAvailableRooms, setEditAvailableRooms] = useState("");
  const [editRentPerMonth, setEditRentPerMonth] = useState("");
  const [editDepositAmount, setEditDepositAmount] = useState("");
  const [editIsFurnished, setEditIsFurnished] = useState<"true" | "false">("true");
  const [editPersonsAllowed, setEditPersonsAllowed] = useState("");
  const [editPetsAllowed, setEditPetsAllowed] = useState<"true" | "false">("true");
  const [editDssAllowed, setEditDssAllowed] = useState<"true" | "false">("true");
  const [editChildrenAllowed, setEditChildrenAllowed] = useState<"true" | "false">("true");
  const [editAvailabilityDate, setEditAvailabilityDate] = useState("");
  const [editLivingLandlord, setEditLivingLandlord] = useState<"true" | "false">("false");
  const [editBusy, setEditBusy] = useState(false);

  const [closingSale, setClosingSale] = useState<CloseSaleForm | null>(null);
  const [closeSaleBusy, setCloseSaleBusy] = useState(false);

  const roleLabel = useMemo(() => currentRole, [currentRole]);

  function updateNewRoom(index: number, key: keyof RoomDraft, value: string) {
    setNewRooms((prev) => prev.map((room, i) => (i === index ? { ...room, [key]: value } : room)));
  }

  function addNewRoom() {
    setNewRooms((prev) => [...prev, createEmptyRoom()]);
  }

  function removeNewRoom(index: number) {
    setNewRooms((prev) => prev.filter((_, i) => i !== index));
  }

  async function load() {
    setLoading(true);
    const result = await fetchLandlordProperties(landlordId);
    setLoading(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to load landlord properties." });
      return;
    }

    setLandlordLabel(`${result.data.landlord.fullName} (${result.data.landlord.phoneLast10})`);
    setProperties(result.data.properties);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [landlordId]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedRooms =
      newVacancyType === "MULTIPLE"
        ? newRooms
            .filter((room) => room.roomName.trim().length > 0)
            .map((room) => ({
              roomName: room.roomName.trim(),
              landlordDemand: room.landlordDemand !== "" ? Number(room.landlordDemand) : undefined,
              expectedCommissionPct:
                room.expectedCommissionPct !== "" ? Number(room.expectedCommissionPct) : undefined,
            }))
        : [];

    if (newVacancyType === "MULTIPLE" && normalizedRooms.length === 0) {
      setMessage({ type: "error", text: "Add at least one room for Shared properties." });
      return;
    }

    setCreating(true);
    const result = await createLandlordProperty(landlordId, {
      propertyRef: newPropertyRef.trim() || undefined,
      addressLine1: newAddressLine1.trim() || undefined,
      city: newCity.trim() || undefined,
      postcode: newPostcode.trim() || undefined,
      status: newStatus,
      vacancyType: newVacancyType,
      landlordDemand: newVacancyType === "SINGLE" && newDemand.trim() ? Number(newDemand) : undefined,
      totalRooms: newTotalRooms.trim() ? Number(newTotalRooms) : null,
      availableRooms: newAvailableRooms.trim() ? Number(newAvailableRooms) : null,
      rentPerMonth: newRentPerMonth.trim() ? Number(newRentPerMonth) : null,
      depositAmount: newDepositAmount.trim() ? Number(newDepositAmount) : null,
      isFurnished: newIsFurnished === "true",
      personsAllowed: newPersonsAllowed.trim() ? Number(newPersonsAllowed) : null,
      petsAllowed: newPetsAllowed === "true",
      dssAllowed: newDssAllowed === "true",
      childrenAllowed: newChildrenAllowed === "true",
      availabilityDate: newAvailabilityDate ? new Date(newAvailabilityDate).toISOString() : null,
      livingLandlord: newLivingLandlord === "true",
      rooms: newVacancyType === "MULTIPLE" ? normalizedRooms : undefined,
    });
    setCreating(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to create property." });
      return;
    }

    setNewPropertyRef("");
    setNewAddressLine1("");
    setNewCity("");
    setNewPostcode("");
    setNewDemand("");
    setNewStatus("DRAFT");
    setNewVacancyType("SINGLE");
    setNewTotalRooms("");
    setNewAvailableRooms("");
    setNewRentPerMonth("");
    setNewDepositAmount("");
    setNewIsFurnished("true");
    setNewPersonsAllowed("");
    setNewPetsAllowed("true");
    setNewDssAllowed("true");
    setNewChildrenAllowed("true");
    setNewAvailabilityDate("");
    setNewLivingLandlord("false");
    setNewRooms([createEmptyRoom()]);
    setMessage({ type: "success", text: "Property created." });
    await load();
  }

  async function saveEdit() {
    if (!editId) return;

    const property = properties.find((row) => row.id === editId);
    if (!property) return;

    const isSingle = (property.vacancyType ?? "SINGLE") === "SINGLE";

    setEditBusy(true);
    const result = await updateProperty(editId, {
      propertyRef: editPropertyRef.trim() || undefined,
      addressLine1: editAddressLine1.trim() || null,
      addressLine2: editAddressLine2.trim() || null,
      city: editCity.trim() || null,
      county: editCounty.trim() || null,
      postcode: editPostcode.trim() || null,
      status: editStatus,
      landlordDemand: isSingle && editDemand.trim() ? Number(editDemand) : null,
      expectedCommissionPct: isSingle && editCommissionType === "pct" && editCommissionPct.trim() ? Number(editCommissionPct) : null,
      expectedCommissionAmt: isSingle && editCommissionType === "amt" && editCommissionAmt.trim() ? Number(editCommissionAmt) : null,
      totalRooms: editTotalRooms.trim() ? Number(editTotalRooms) : null,
      availableRooms: editAvailableRooms.trim() ? Number(editAvailableRooms) : null,
      rentPerMonth: editRentPerMonth.trim() ? Number(editRentPerMonth) : null,
      depositAmount: editDepositAmount.trim() ? Number(editDepositAmount) : null,
      isFurnished: editIsFurnished === "true",
      personsAllowed: editPersonsAllowed.trim() ? Number(editPersonsAllowed) : null,
      petsAllowed: editPetsAllowed === "true",
      dssAllowed: editDssAllowed === "true",
      childrenAllowed: editChildrenAllowed === "true",
      availabilityDate: editAvailabilityDate ? new Date(editAvailabilityDate).toISOString() : null,
      livingLandlord: editLivingLandlord === "true",
    });
    setEditBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update property." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Changes submitted for admin approval.",
      });
      setEditId(null);
      return;
    }

    setMessage({ type: "success", text: "Property updated." });
    setEditId(null);
    await load();
  }

  async function submitCloseSale() {
    if (!closingSale) return;

    const finalAmount = Number(closingSale.finalAmount);
    const otherCosts = closingSale.otherCosts.trim() ? Number(closingSale.otherCosts) : undefined;

    if (!Number.isFinite(finalAmount) || finalAmount <= 0) {
      setMessage({ type: "error", text: "Final amount must be a positive number." });
      return;
    }

    let commissionPct: number;
    if (closingSale.commissionType === "amt") {
      const commissionAmt = Number(closingSale.commissionAmt);
      if (!Number.isFinite(commissionAmt) || commissionAmt < 0) {
        setMessage({ type: "error", text: "Commission amount must be zero or positive." });
        return;
      }
      commissionPct = finalAmount > 0 ? (commissionAmt / finalAmount) * 100 : 0;
    } else {
      commissionPct = Number(closingSale.commissionPct);
      if (!Number.isFinite(commissionPct) || commissionPct < 0) {
        setMessage({ type: "error", text: "Commission % must be zero or positive." });
        return;
      }
    }

    const tenantFirst = closingSale.tenantFirstName.trim();
    const tenantLast = closingSale.tenantLastName.trim();
    if (!tenantFirst || !tenantLast) {
      setMessage({ type: "error", text: "Tenant first and last name are required." });
      return;
    }

    setCloseSaleBusy(true);

    const payload = {
      finalAmount,
      commissionPct,
      otherCosts,
      tenant: {
        firstName: tenantFirst,
        lastName: tenantLast,
        fullName: `${tenantFirst} ${tenantLast}`,
        email: closingSale.tenantEmail.trim() || undefined,
        phone: closingSale.tenantPhone.trim() || undefined,
        currentAddress: closingSale.tenantAddress.trim() || undefined,
        moveInDate: closingSale.tenantMoveInDate || undefined,
        rentAmount: closingSale.tenantRent.trim() ? Number(closingSale.tenantRent) : undefined,
        depositAmount: closingSale.tenantDeposit.trim() ? Number(closingSale.tenantDeposit) : undefined,
        notes: closingSale.tenantNotes.trim() || undefined,
        accommodationType: closingSale.tenantAccommodationType || undefined,
        tenantRoomType: closingSale.tenantRoomType || undefined,
        nationality: closingSale.tenantNationality.trim() || undefined,
        countryOriginal: closingSale.tenantCountryOriginal.trim() || undefined,
        numberOfOccupants: closingSale.tenantNumOccupants ? Number(closingSale.tenantNumOccupants) : undefined,
        numberOfChildren: closingSale.tenantNumChildren ? Number(closingSale.tenantNumChildren) : undefined,
        onDSS: closingSale.tenantOnDSS,
        currentlyEmployed: closingSale.tenantEmployed,
        annualIncome: closingSale.tenantAnnualIncome ? Number(closingSale.tenantAnnualIncome) : undefined,
        currentLivingPostcode: closingSale.tenantCurrentPostcode.toUpperCase() || undefined,
        workplacePostcode: closingSale.tenantWorkplacePostcode.toUpperCase() || undefined,
        maximumBudget: closingSale.tenantMaxBudget ? Number(closingSale.tenantMaxBudget) : undefined,
        workingProfession: closingSale.tenantProfession.trim() || undefined,
        immigrationStatus: closingSale.tenantImmigrationStatus || undefined,
      },
    };

    const result = closingSale.roomId
      ? await closePropertyRoomSale(closingSale.propertyId, closingSale.roomId, payload)
      : await closePropertySale(closingSale.propertyId, payload);

    setCloseSaleBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to close sale." });
      return;
    }

    setClosingSale(null);
    if (closingSale.roomId) {
      const allRoomsClosed = "allRoomsClosed" in result.data && result.data.allRoomsClosed;
      setMessage({
        type: "success",
        text: allRoomsClosed
          ? "Room sale closed. All rooms are closed and property marked Closed."
          : "Room sale closed successfully.",
      });
    } else {
      setMessage({ type: "success", text: "Sale closed and property marked Closed. Tenant details recorded." });
    }
    await load();
  }

  if (loading) {
    return <p className="muted">Loading properties...</p>;
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Landlord Properties</h1>
          <p className="page-subtitle">{landlordLabel}</p>
        </div>
        <div className="inline-row">
          <Link className="btn btn-secondary" href={`/landlords/${landlordId}`}>
            Back to Landlord
          </Link>
          <Link className="btn btn-secondary" href="/landlords">
            Registry
          </Link>
        </div>
      </header>

      {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

      <UICard>
        <UICardBody>
          <form className="field-grid" onSubmit={onCreate}>
            <div className="field-grid-2">
              <label className="field">
                <span className="label">Property Reference (optional)</span>
                <UIInput
                  value={newPropertyRef}
                  onChange={(event) => setNewPropertyRef(event.target.value)}
                  placeholder="Auto-generated if empty"
                />
              </label>
              <label className="field">
                <span className="label">Property Full Address <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput value={newAddressLine1} onChange={(event) => setNewAddressLine1(event.target.value)} required />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">City <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput value={newCity} onChange={(event) => setNewCity(event.target.value)} required />
              </label>
              <label className="field">
                <span className="label">Postcode <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput value={newPostcode} onChange={(event) => setNewPostcode(event.target.value)} required />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Status</span>
                <UISelect value={newStatus} onChange={(event) => setNewStatus(event.target.value as PropertyStatus)}>
                  <option value="DRAFT">Draft</option>
                  <option value="AVAILABLE">Available</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">Property Category</span>
                <UISelect value={newVacancyType} onChange={(e) => setNewVacancyType(e.target.value as VacancyType)}>
                  <option value="SINGLE">Private Property</option>
                  <option value="MULTIPLE">Shared Property</option>
                </UISelect>
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Total Number of Rooms <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput
                  type="number"
                  min={0}
                  step="1"
                  value={newTotalRooms}
                  onChange={(event) => setNewTotalRooms(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Available Rooms <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput
                  type="number"
                  min={0}
                  step="1"
                  value={newAvailableRooms}
                  onChange={(event) => setNewAvailableRooms(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Rent per Month (GBP) <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={newRentPerMonth}
                  onChange={(event) => setNewRentPerMonth(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Deposit Amount (GBP) <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={newDepositAmount}
                  onChange={(event) => setNewDepositAmount(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Property Furnished <span style={{ color: "var(--danger)" }}>*</span></span>
                <UISelect value={newIsFurnished} onChange={(e) => setNewIsFurnished(e.target.value as "true" | "false")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">Number of Persons Allowed <span style={{ color: "var(--danger)" }}>*</span></span>
                <UIInput
                  type="number"
                  min={1}
                  step="1"
                  value={newPersonsAllowed}
                  onChange={(event) => setNewPersonsAllowed(event.target.value)}
                  required
                />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Pets Allowed <span style={{ color: "var(--danger)" }}>*</span></span>
                <UISelect value={newPetsAllowed} onChange={(e) => setNewPetsAllowed(e.target.value as "true" | "false")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">DSS Allowed <span style={{ color: "var(--danger)" }}>*</span></span>
                <UISelect value={newDssAllowed} onChange={(e) => setNewDssAllowed(e.target.value as "true" | "false")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Children Allowed <span style={{ color: "var(--danger)" }}>*</span></span>
                <UISelect value={newChildrenAllowed} onChange={(e) => setNewChildrenAllowed(e.target.value as "true" | "false")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">Living Landlord <span style={{ color: "var(--danger)" }}>*</span></span>
                <UISelect value={newLivingLandlord} onChange={(e) => setNewLivingLandlord(e.target.value as "true" | "false")}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
            </div>

            <label className="field">
              <span className="label">Property Availability Date <span style={{ color: "var(--danger)" }}>*</span></span>
              <UIInput
                type="date"
                value={newAvailabilityDate}
                onChange={(event) => setNewAvailabilityDate(event.target.value)}
                required
              />
            </label>

            {newVacancyType === "SINGLE" ? (
              <label className="field">
                <span className="label">Landlord Demand (GBP)</span>
                <UIInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={newDemand}
                  onChange={(event) => setNewDemand(event.target.value)}
                />
              </label>
            ) : (
              <div className="room-editor">
                <div className="table-wrap room-editor-wrap">
                  <table className="room-editor-table">
                    <thead>
                      <tr>
                        <th>Room Type</th>
                        <th>Landlord Demand (GBP)</th>
                        <th>Expected Commission (%)</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {newRooms.map((room, index) => (
                        <tr key={`new-room-${index}`}>
                          <td>
                            <UISelect
                              value={room.roomName}
                              onChange={(e) => updateNewRoom(index, "roomName", e.target.value)}
                            >
                              {ROOM_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </UISelect>
                          </td>
                          <td>
                            <UIInput
                              type="number"
                              min={0}
                              step="0.01"
                              value={room.landlordDemand}
                              onChange={(e) => updateNewRoom(index, "landlordDemand", e.target.value)}
                              placeholder="Optional"
                            />
                          </td>
                          <td>
                            <UIInput
                              type="number"
                              min={0}
                              step="0.1"
                              value={room.expectedCommissionPct}
                              onChange={(e) => updateNewRoom(index, "expectedCommissionPct", e.target.value)}
                              placeholder="Optional"
                            />
                          </td>
                          <td>
                            <UIButton
                              type="button"
                              variant="secondary"
                              onClick={() => removeNewRoom(index)}
                              disabled={newRooms.length <= 1}
                            >
                              Remove
                            </UIButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="inline-row">
                  <UIButton type="button" variant="secondary" onClick={addNewRoom}>
                    Add Room Row
                  </UIButton>
                </div>
              </div>
            )}

            <div className="inline-row">
              <UIButton type="submit" disabled={creating}>
                {creating ? "Adding..." : "Add Property"}
              </UIButton>
            </div>
          </form>
        </UICardBody>
      </UICard>

      <UICard>
        <UICardBody>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>City / Postcode</th>
                  <th>Demand</th>
                  <th>Closed Sales</th>
                  <th>Rooms</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => {
                  const editing = editId === property.id;
                  const vacancy = property.vacancyType ?? "SINGLE";
                  const sales = getSales(property);
                  const totalSalesAmount = sales.reduce((sum, sale) => sum + Number(sale.finalAmount ?? 0), 0);
                  const canCloseSale =
                    vacancy === "SINGLE" &&
                    sales.length === 0 &&
                    (property.status === "AVAILABLE" || property.status === "DRAFT");

                  return (
                    <tr key={property.id}>
                      <td>{property.propertyRef}</td>
                      <td>
                        <span className={`badge ${vacancy === "MULTIPLE" ? "badge-offer" : "badge-active"}`}>
                          {vacancy === "MULTIPLE" ? "Shared" : "Private"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_CONFIG[property.status]?.badgeClass ?? "badge-draft"}`}>
                          {STATUS_CONFIG[property.status]?.label ?? property.status}
                        </span>
                      </td>
                      <td>{`${property.city ?? "-"} / ${property.postcode ?? "-"}`}</td>
                      <td>
                        {vacancy === "MULTIPLE" ? (
                          <span className="muted">Per room</span>
                        ) : property.landlordDemand ? (
                          `\u00A3${property.landlordDemand}`
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {sales.length > 0 ? (
                          <div>
                            <strong style={{ color: "#4ade80" }}>{sales.length}</strong>
                            <span className="muted" style={{ marginLeft: "0.35rem" }}>
                              ({'\u00A3'}{Math.round(totalSalesAmount).toLocaleString("en-GB")})
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {vacancy === "MULTIPLE" ? (
                          <div className="room-chip-list">
                            {(property.rooms ?? []).map((room) => {
                              const canCloseRoom =
                                !room.sale &&
                                room.status !== "CLOSED" &&
                                (property.status === "AVAILABLE" || property.status === "DRAFT");
                              return (
                                <div key={room.id} className="room-chip">
                                  <div className="room-chip-head">
                                    <strong>{room.roomName}</strong>
                                    <span className={`badge ${roomStatusBadge(room.status)}`}>{room.status}</span>
                                  </div>
                                  <div className="room-chip-sub">
                                    {room.landlordDemand ? `\u00A3${room.landlordDemand}` : "No demand"}{" "}
                                    {room.expectedCommissionPct ? `| ${room.expectedCommissionPct}%` : ""}
                                  </div>
                                  {room.sale ? (
                                    <div className="room-chip-sub">
                                      Sold {'\u00A3'}{Math.round(Number(room.sale.finalAmount)).toLocaleString("en-GB")}
                                    </div>
                                  ) : canCloseRoom ? (
                                    <UIButton
                                      variant="secondary"
                                      onClick={() =>
                                        setClosingSale({
                                          propertyId: property.id,
                                          roomId: room.id,
                                          roomName: room.roomName,
                                          finalAmount: "",
                                          commissionType: "pct",
                                          commissionPct: room.expectedCommissionPct ?? "",
                                          commissionAmt: "",
                                          otherCosts: "",
                                          tenantFirstName: "",
                                          tenantLastName: "",
                                          tenantEmail: "",
                                          tenantPhone: "",
                                          tenantAddress: "",
                                          tenantMoveInDate: "",
                                          tenantRent: "",
                                          tenantDeposit: "",
                                          tenantNotes: "",
                                          tenantAccommodationType: "SHARED",
                                          tenantRoomType: "",
                                          tenantNationality: "",
                                          tenantCountryOriginal: "",
                                          tenantNumOccupants: "",
                                          tenantNumChildren: "",
                                          tenantOnDSS: false,
                                          tenantEmployed: false,
                                          tenantAnnualIncome: "",
                                          tenantCurrentPostcode: "",
                                          tenantWorkplacePostcode: "",
                                          tenantMaxBudget: "",
                                          tenantProfession: "",
                                          tenantImmigrationStatus: "",
                                        })
                                      }
                                    >
                                      Close Room
                                    </UIButton>
                                  ) : null}
                                </div>
                              );
                            })}
                            {(property.rooms ?? []).length === 0 && <span className="muted">No rooms added.</span>}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>{formatDate(property.createdAt)}</td>
                      <td>
                        <div className="inline-row">
                          {!editing && (
                            <>
                              <Link className="btn btn-secondary" href={`/portal/properties/${property.id}`}>
                                View
                              </Link>
                              <UIButton
                                variant="secondary"
                                onClick={() => {
                                  setEditId(property.id);
                                  setEditPropertyRef(property.propertyRef);
                                  setEditStatus(property.status);
                                  setEditAddressLine1(property.addressLine1 ?? "");
                                  setEditAddressLine2(property.addressLine2 ?? "");
                                  setEditCity(property.city ?? "");
                                  setEditCounty(property.county ?? "");
                                  setEditPostcode(property.postcode ?? "");
                                  setEditDemand(property.landlordDemand ?? "");
                                  if (property.expectedCommissionAmt != null) {
                                    setEditCommissionType("amt");
                                    setEditCommissionAmt(String(property.expectedCommissionAmt));
                                    setEditCommissionPct("");
                                  } else {
                                    setEditCommissionType("pct");
                                    setEditCommissionPct(property.expectedCommissionPct ?? "");
                                    setEditCommissionAmt("");
                                  }
                                  setEditTotalRooms(property.totalRooms != null ? String(property.totalRooms) : "");
                                  setEditAvailableRooms(property.availableRooms != null ? String(property.availableRooms) : "");
                                  setEditRentPerMonth(property.rentPerMonth ?? "");
                                  setEditDepositAmount(property.depositAmount ?? "");
                                  setEditIsFurnished(property.isFurnished === false ? "false" : "true");
                                  setEditPersonsAllowed(property.personsAllowed != null ? String(property.personsAllowed) : "");
                                  setEditPetsAllowed(property.petsAllowed === false ? "false" : "true");
                                  setEditDssAllowed(property.dssAllowed === false ? "false" : "true");
                                  setEditChildrenAllowed(property.childrenAllowed === false ? "false" : "true");
                                  setEditAvailabilityDate(
                                    property.availabilityDate
                                      ? new Date(property.availabilityDate).toISOString().slice(0, 10)
                                      : ""
                                  );
                                  setEditLivingLandlord(property.livingLandlord === true ? "true" : "false");
                                }}
                              >
                                Edit
                              </UIButton>
                            </>
                          )}

                          {canCloseSale ? (
                            <UIButton
                              variant="secondary"
                              onClick={() =>
                                setClosingSale({
                                  propertyId: property.id,
                                  finalAmount: "",
                                  commissionType: property.expectedCommissionAmt != null ? "amt" : "pct",
                                  commissionPct: property.expectedCommissionPct ?? "",
                                  commissionAmt: property.expectedCommissionAmt ?? "",
                                  otherCosts: "",
                                  tenantFirstName: "",
                                  tenantLastName: "",
                                  tenantEmail: "",
                                  tenantPhone: "",
                                  tenantAddress: "",
                                  tenantMoveInDate: "",
                                  tenantRent: "",
                                  tenantDeposit: "",
                                  tenantNotes: "",
                                  tenantAccommodationType: "PRIVATE",
                                  tenantRoomType: "",
                                  tenantNationality: "",
                                  tenantCountryOriginal: "",
                                  tenantNumOccupants: "",
                                  tenantNumChildren: "",
                                  tenantOnDSS: false,
                                  tenantEmployed: false,
                                  tenantAnnualIncome: "",
                                  tenantCurrentPostcode: "",
                                  tenantWorkplacePostcode: "",
                                  tenantMaxBudget: "",
                                  tenantProfession: "",
                                  tenantImmigrationStatus: "",
                                })
                              }
                            >
                              Close Sale
                            </UIButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="muted">
                      No properties found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="muted">{properties.length} properties listed. Role: {roleLabel}</p>
        </UICardBody>
      </UICard>

      {editId ? (
        <UICard>
          <UICardBody>
            <div className="stack">
              <h3 style={{ margin: 0, color: "var(--brand-gold)" }}>Edit Property</h3>

              <div className="form-section-divider"><span className="form-section-label">Address</span></div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Property Reference</span>
                  <UIInput value={editPropertyRef} onChange={(e) => setEditPropertyRef(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">Status</span>
                  <UISelect value={editStatus} onChange={(e) => setEditStatus(e.target.value as PropertyStatus)} disabled={editBusy}>
                    <option value="DRAFT">Draft</option>
                    <option value="AVAILABLE">Available</option>
                  </UISelect>
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Address Line 1</span>
                  <UIInput value={editAddressLine1} onChange={(e) => setEditAddressLine1(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">Address Line 2 (optional)</span>
                  <UIInput value={editAddressLine2} onChange={(e) => setEditAddressLine2(e.target.value)} disabled={editBusy} />
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">City</span>
                  <UIInput value={editCity} onChange={(e) => setEditCity(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">Postcode</span>
                  <UIInput value={editPostcode} onChange={(e) => setEditPostcode(e.target.value)} disabled={editBusy} />
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">County (optional)</span>
                  <UIInput value={editCounty} onChange={(e) => setEditCounty(e.target.value)} disabled={editBusy} />
                </label>
              </div>

              <div className="form-section-divider"><span className="form-section-label">Property Details</span></div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Total Rooms</span>
                  <UIInput type="number" min={0} step="1" value={editTotalRooms} onChange={(e) => setEditTotalRooms(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">Available Rooms</span>
                  <UIInput type="number" min={0} step="1" value={editAvailableRooms} onChange={(e) => setEditAvailableRooms(e.target.value)} disabled={editBusy} />
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Rent per Month (GBP)</span>
                  <UIInput type="number" min={0} step="0.01" value={editRentPerMonth} onChange={(e) => setEditRentPerMonth(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">Deposit Amount (GBP)</span>
                  <UIInput type="number" min={0} step="0.01" value={editDepositAmount} onChange={(e) => setEditDepositAmount(e.target.value)} disabled={editBusy} />
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Furnished</span>
                  <UISelect value={editIsFurnished} onChange={(e) => setEditIsFurnished(e.target.value as "true" | "false")} disabled={editBusy}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </UISelect>
                </label>
                <label className="field">
                  <span className="label">Persons Allowed</span>
                  <UIInput type="number" min={1} step="1" value={editPersonsAllowed} onChange={(e) => setEditPersonsAllowed(e.target.value)} disabled={editBusy} />
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Pets Allowed</span>
                  <UISelect value={editPetsAllowed} onChange={(e) => setEditPetsAllowed(e.target.value as "true" | "false")} disabled={editBusy}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </UISelect>
                </label>
                <label className="field">
                  <span className="label">DSS Allowed</span>
                  <UISelect value={editDssAllowed} onChange={(e) => setEditDssAllowed(e.target.value as "true" | "false")} disabled={editBusy}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </UISelect>
                </label>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Children Allowed</span>
                  <UISelect value={editChildrenAllowed} onChange={(e) => setEditChildrenAllowed(e.target.value as "true" | "false")} disabled={editBusy}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </UISelect>
                </label>
                <label className="field">
                  <span className="label">Living Landlord</span>
                  <UISelect value={editLivingLandlord} onChange={(e) => setEditLivingLandlord(e.target.value as "true" | "false")} disabled={editBusy}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </UISelect>
                </label>
              </div>
              <label className="field" style={{ maxWidth: 280 }}>
                <span className="label">Availability Date</span>
                <UIInput type="date" value={editAvailabilityDate} onChange={(e) => setEditAvailabilityDate(e.target.value)} disabled={editBusy} />
              </label>

              <div className="form-section-divider"><span className="form-section-label">Financial</span></div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Landlord Demand (GBP)</span>
                  <UIInput type="number" min={0} step="0.01" value={editDemand} onChange={(e) => setEditDemand(e.target.value)} disabled={editBusy} />
                </label>
                <label className="field">
                  <span className="label">
                    Expected Commission
                    <span style={{ display: "inline-flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
                      <button type="button" onClick={() => setEditCommissionType("pct")} disabled={editBusy}
                        style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.4rem", border: "1px solid var(--border)", borderRadius: "0.25rem",
                          background: editCommissionType === "pct" ? "var(--brand-gold)" : "transparent",
                          color: editCommissionType === "pct" ? "#000" : "var(--text-muted)", cursor: "pointer" }}>%</button>
                      <button type="button" onClick={() => setEditCommissionType("amt")} disabled={editBusy}
                        style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.4rem", border: "1px solid var(--border)", borderRadius: "0.25rem",
                          background: editCommissionType === "amt" ? "var(--brand-gold)" : "transparent",
                          color: editCommissionType === "amt" ? "#000" : "var(--text-muted)", cursor: "pointer" }}>£</button>
                    </span>
                  </span>
                  {editCommissionType === "pct" ? (
                    <UIInput type="number" min={0} max={9999} step="0.1" value={editCommissionPct} onChange={(e) => setEditCommissionPct(e.target.value)} placeholder="e.g. 10" disabled={editBusy} />
                  ) : (
                    <UIInput type="number" min={0} step="0.01" value={editCommissionAmt} onChange={(e) => setEditCommissionAmt(e.target.value)} placeholder="e.g. 500" disabled={editBusy} />
                  )}
                </label>
              </div>

              <div className="inline-row">
                <UIButton onClick={() => void saveEdit()} disabled={editBusy}>
                  {editBusy ? "Saving..." : "Save Changes"}
                </UIButton>
                <UIButton variant="secondary" onClick={() => setEditId(null)} disabled={editBusy}>
                  Cancel
                </UIButton>
              </div>
            </div>
          </UICardBody>
        </UICard>
      ) : null}

      {closingSale ? (
        <UICard>
          <UICardBody>
            <div className="stack">
              <h3 style={{ margin: 0, color: "var(--brand-gold)" }}>
                {closingSale.roomId ? `Close Room Sale (${closingSale.roomName})` : "Close Property Sale"}
              </h3>

              <div className="form-section-divider">
                <span className="form-section-label">Sale Details</span>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Final Sale Amount (GBP) *</span>
                  <UIInput
                    type="number"
                    min={0}
                    step="0.01"
                    value={closingSale.finalAmount}
                    onChange={(event) =>
                      setClosingSale((prev) => (prev ? { ...prev, finalAmount: event.target.value } : prev))
                    }
                  />
                </label>
                <label className="field">
                  <span className="label">
                    Commission *
                    <span style={{ display: "inline-flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
                      <button type="button"
                        onClick={() => setClosingSale((prev) => prev ? { ...prev, commissionType: "pct" } : prev)}
                        style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.4rem", border: "1px solid var(--border)", borderRadius: "0.25rem",
                          background: closingSale.commissionType === "pct" ? "var(--brand-gold)" : "transparent",
                          color: closingSale.commissionType === "pct" ? "#000" : "var(--text-muted)", cursor: "pointer" }}>%</button>
                      <button type="button"
                        onClick={() => setClosingSale((prev) => prev ? { ...prev, commissionType: "amt" } : prev)}
                        style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.4rem", border: "1px solid var(--border)", borderRadius: "0.25rem",
                          background: closingSale.commissionType === "amt" ? "var(--brand-gold)" : "transparent",
                          color: closingSale.commissionType === "amt" ? "#000" : "var(--text-muted)", cursor: "pointer" }}>£</button>
                    </span>
                  </span>
                  {closingSale.commissionType === "pct" ? (
                    <UIInput
                      type="number" min={0} max={9999} step="0.01"
                      value={closingSale.commissionPct}
                      onChange={(event) =>
                        setClosingSale((prev) => (prev ? { ...prev, commissionPct: event.target.value } : prev))
                      }
                      placeholder="e.g. 10"
                    />
                  ) : (
                    <UIInput
                      type="number" min={0} step="0.01"
                      value={closingSale.commissionAmt}
                      onChange={(event) =>
                        setClosingSale((prev) => (prev ? { ...prev, commissionAmt: event.target.value } : prev))
                      }
                      placeholder="e.g. 500"
                    />
                  )}
                </label>
                <label className="field">
                  <span className="label">Other Costs (GBP, optional)</span>
                  <UIInput
                    type="number"
                    min={0}
                    step="0.01"
                    value={closingSale.otherCosts}
                    onChange={(event) =>
                      setClosingSale((prev) => (prev ? { ...prev, otherCosts: event.target.value } : prev))
                    }
                  />
                </label>
              </div>

              <div className="form-section-divider">
                <span className="form-section-label">Tenant Details</span>
              </div>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">First Name *</span>
                  <UIInput
                    value={closingSale.tenantFirstName}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantFirstName: e.target.value } : p)}
                    placeholder="Jane"
                  />
                </label>
                <label className="field">
                  <span className="label">Last Name *</span>
                  <UIInput
                    value={closingSale.tenantLastName}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantLastName: e.target.value } : p)}
                    placeholder="Smith"
                  />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <UIInput type="email"
                    value={closingSale.tenantEmail}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantEmail: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Phone</span>
                  <UIInput
                    value={closingSale.tenantPhone}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantPhone: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Accommodation Type</span>
                  <select className="input"
                    value={closingSale.tenantAccommodationType}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantAccommodationType: e.target.value as any } : p)}
                  >
                    <option value="">— Select —</option>
                    <option value="PRIVATE">Private</option>
                    <option value="SHARED">Shared</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Room Type</span>
                  <select className="input"
                    value={closingSale.tenantRoomType}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantRoomType: e.target.value } : p)}
                  >
                    <option value="">— Select —</option>
                    <option value="STUDIO_ROOM">Studio Room</option>
                    <option value="SINGLE_ROOM">Single Room</option>
                    <option value="DOUBLE_ROOM">Double Room</option>
                    <option value="ENSUITE_ROOM">En-Suite Room</option>
                    <option value="LOFT">Loft</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Nationality</span>
                  <UIInput
                    value={closingSale.tenantNationality}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantNationality: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Country of Origin</span>
                  <UIInput
                    value={closingSale.tenantCountryOriginal}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantCountryOriginal: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Immigration Status</span>
                  <select className="input"
                    value={closingSale.tenantImmigrationStatus}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantImmigrationStatus: e.target.value } : p)}
                  >
                    <option value="">— Select —</option>
                    <option value="British Citizen">British Citizen</option>
                    <option value="Settled Status (ILR)">Settled Status (ILR)</option>
                    <option value="Pre-Settled Status">Pre-Settled Status</option>
                    <option value="Student Visa">Student Visa</option>
                    <option value="Skilled Worker Visa">Skilled Worker Visa</option>
                    <option value="Family Visa">Family Visa</option>
                    <option value="Refugee / Asylum">Refugee / Asylum</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="field">
                  <span className="label">Profession</span>
                  <UIInput
                    value={closingSale.tenantProfession}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantProfession: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Annual Income (£)</span>
                  <UIInput type="number" min={0}
                    value={closingSale.tenantAnnualIncome}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantAnnualIncome: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">No. of Occupants</span>
                  <UIInput type="number" min={1}
                    value={closingSale.tenantNumOccupants}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantNumOccupants: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">No. of Children</span>
                  <UIInput type="number" min={0}
                    value={closingSale.tenantNumChildren}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantNumChildren: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Current Living Postcode</span>
                  <UIInput
                    value={closingSale.tenantCurrentPostcode}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantCurrentPostcode: e.target.value.toUpperCase() } : p)}
                    placeholder="M1 1AB"
                  />
                </label>
                <label className="field">
                  <span className="label">Workplace Postcode</span>
                  <UIInput
                    value={closingSale.tenantWorkplacePostcode}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantWorkplacePostcode: e.target.value.toUpperCase() } : p)}
                    placeholder="M2 3BC"
                  />
                </label>
                <label className="field">
                  <span className="label">Move-In Date</span>
                  <UIInput type="date"
                    value={closingSale.tenantMoveInDate}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantMoveInDate: e.target.value } : p)}
                  />
                </label>
                <label className="field">
                  <span className="label">Max Budget (£/mo)</span>
                  <UIInput type="number" min={0}
                    value={closingSale.tenantMaxBudget}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantMaxBudget: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Monthly Rent (GBP)</span>
                  <UIInput type="number" min={0} step="0.01"
                    value={closingSale.tenantRent}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantRent: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
                <label className="field">
                  <span className="label">Deposit (GBP)</span>
                  <UIInput type="number" min={0} step="0.01"
                    value={closingSale.tenantDeposit}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantDeposit: e.target.value } : p)}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="field-grid-2">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer", color: "var(--text)" }}>
                  <input type="checkbox"
                    checked={closingSale.tenantOnDSS}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantOnDSS: e.target.checked } : p)}
                  />
                  On DSS / Benefits
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", cursor: "pointer", color: "var(--text)" }}>
                  <input type="checkbox"
                    checked={closingSale.tenantEmployed}
                    onChange={(e) => setClosingSale((p) => p ? { ...p, tenantEmployed: e.target.checked } : p)}
                  />
                  Currently Employed
                </label>
              </div>
              <label className="field">
                <span className="label">Current Address</span>
                <UIInput
                  value={closingSale.tenantAddress}
                  onChange={(e) => setClosingSale((p) => p ? { ...p, tenantAddress: e.target.value } : p)}
                  placeholder="Optional"
                />
              </label>
              <label className="field">
                <span className="label">Notes</span>
                <UIInput
                  value={closingSale.tenantNotes}
                  onChange={(e) => setClosingSale((p) => p ? { ...p, tenantNotes: e.target.value } : p)}
                  placeholder="Optional"
                />
              </label>

              <div className="inline-row">
                <UIButton onClick={() => void submitCloseSale()} disabled={closeSaleBusy}>
                  {closeSaleBusy ? "Closing..." : "Confirm Close Sale"}
                </UIButton>
                <UIButton variant="secondary" onClick={() => setClosingSale(null)} disabled={closeSaleBusy}>
                  Cancel
                </UIButton>
              </div>
            </div>
          </UICardBody>
        </UICard>
      ) : null}
    </div>
  );
}
