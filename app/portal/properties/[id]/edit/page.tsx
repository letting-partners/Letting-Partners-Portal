"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UICard, UICardBody } from "@/components/ui/card";
import { UIInput } from "@/components/ui/input";
import { UISelect } from "@/components/ui/select";
import { MediaLibraryPicker, type MediaSelectionValue } from "@/components/media-library-picker";
import {
  fetchLandlordsForDropdown,
  updateProperty,
  addPropertyRoom,
  updatePropertyRoom,
  deletePropertyRoom,
  type LandlordRow,
  type PropertyStatus,
} from "@/lib/portal-api";
import { apiGet } from "@/lib/api-client";

type RoomRow = {
  id: string;
  roomName: string;
  landlordDemand: string | number | null;
  expectedCommissionPct: string | number | null;
  status: string;
  sale?: { id: string; finalAmount?: number | null; closedAt?: string | null } | null;
};

type PropertyDetail = {
  id: string;
  propertyRef: string;
  title: string | null;
  description: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  status: PropertyStatus;
  vacancyType: string;
  landlordId: string;
  ownerAgentId: string;
  landlordDemand: number | null;
  expectedCommissionPct: number | null;
  expectedCommissionAmt: number | null;
  totalRooms: number | null;
  availableRooms: number | null;
  rentPerMonth: number | null;
  depositAmount: number | null;
  isFurnished: boolean | null;
  personsAllowed: number | null;
  petsAllowed: boolean | null;
  dssAllowed: boolean | null;
  childrenAllowed: boolean | null;
  availabilityDate: string | null;
  livingLandlord: boolean | null;
  landlord: { id: string; landlordName: string; phoneLast10: string | null };
  rooms?: RoomRow[];
  images?: Array<{ id: string; name?: string; altText?: string | null }>;
};

const ROOM_TYPES = ["Studio Room", "Single Room", "Double Room", "Ensuite Room", "Loft"] as const;

const STATUS_OPTIONS: { value: PropertyStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft (saved, not listed)" },
  { value: "AVAILABLE", label: "Available (active listing)" },
];

type Props = { params: { id: string } };

export default function EditPropertyPage({ params }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const propertyId = params.id;
  const adminMode = pathname?.startsWith("/admin/") ?? false;
  const detailHref = adminMode ? `/admin/properties/${propertyId}` : `/portal/properties/${propertyId}`;

  const [loading, setLoading] = useState(true);
  const [original, setOriginal] = useState<PropertyDetail | null>(null);
  const [landlords, setLandlords] = useState<LandlordRow[]>([]);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [roomBusyId, setRoomBusyId] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

  // Editable fields
  const [selectedLandlordId, setSelectedLandlordId] = useState("");
  const [propertyRef, setPropertyRef] = useState("");
  const [propertyTitle, setPropertyTitle] = useState("");
  const [propertyDescription, setPropertyDescription] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<MediaSelectionValue[]>([]);
  const [status, setStatus] = useState<PropertyStatus>("DRAFT");
  const [propertyType, setPropertyType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [landlordDemand, setLandlordDemand] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [commissionAmt, setCommissionAmt] = useState("");
  const [commissionType, setCommissionType] = useState<"pct" | "amt">("pct");
  const [totalRooms, setTotalRooms] = useState("");
  const [availableRooms, setAvailableRooms] = useState("");
  const [rentPerMonth, setRentPerMonth] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [isFurnished, setIsFurnished] = useState<"true" | "false">("true");
  const [personsAllowed, setPersonsAllowed] = useState("");
  const [petsAllowed, setPetsAllowed] = useState<"true" | "false">("true");
  const [dssAllowed, setDssAllowed] = useState<"true" | "false">("true");
  const [childrenAllowed, setChildrenAllowed] = useState<"true" | "false">("true");
  const [availabilityDate, setAvailabilityDate] = useState("");
  const [livingLandlord, setLivingLandlord] = useState<"true" | "false">("false");

  // Room editing (MULTIPLE only)
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [addingRoom, setAddingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ roomName: ROOM_TYPES[0] as string, landlordDemand: "", expectedCommissionPct: "" });

  useEffect(() => {
    void Promise.all([
      apiGet<{ property: PropertyDetail }>(`/api/properties/${propertyId}`),
      fetchLandlordsForDropdown(),
    ]).then(([propResult, landlordResult]) => {
      setLoading(false);
      if (!propResult.ok) {
        setMessage({ type: "error", text: propResult.message ?? "Failed to load property." });
        return;
      }
      if (landlordResult.ok) setLandlords(landlordResult.data.landlords);

      const p = propResult.data.property;
      setOriginal(p);
      setSelectedLandlordId(p.landlordId);
      setPropertyRef(p.propertyRef ?? "");
      setPropertyTitle(p.title ?? "");
      setPropertyDescription(p.description ?? "");
      setSelectedAssets(
        (p.images ?? []).map((img) => ({
          mediaAssetId: img.id,
          altText: img.altText?.trim() || img.name?.trim() || "Property photo",
        })),
      );
      setStatus(p.status === "CLOSED" ? "AVAILABLE" : p.status);
      setPropertyType(p.propertyType ?? "");
      setBeds(p.beds != null ? String(p.beds) : "");
      setBaths(p.baths != null ? String(p.baths) : "");
      setLandlordDemand(p.landlordDemand != null ? String(p.landlordDemand) : "");
      if (p.expectedCommissionAmt != null) {
        setCommissionType("amt");
        setCommissionAmt(String(p.expectedCommissionAmt));
      } else {
        setCommissionType("pct");
        setCommissionPct(p.expectedCommissionPct != null ? String(p.expectedCommissionPct) : "");
      }
      setTotalRooms(p.totalRooms != null ? String(p.totalRooms) : "");
      setAvailableRooms(p.availableRooms != null ? String(p.availableRooms) : "");
      setRentPerMonth(p.rentPerMonth != null ? String(p.rentPerMonth) : "");
      setDepositAmount(p.depositAmount != null ? String(p.depositAmount) : "");
      setIsFurnished(p.isFurnished === false ? "false" : "true");
      setPersonsAllowed(p.personsAllowed != null ? String(p.personsAllowed) : "");
      setPetsAllowed(p.petsAllowed === false ? "false" : "true");
      setDssAllowed(p.dssAllowed === false ? "false" : "true");
      setChildrenAllowed(p.childrenAllowed === false ? "false" : "true");
      setAvailabilityDate(
        p.availabilityDate ? new Date(p.availabilityDate).toISOString().slice(0, 10) : ""
      );
      setLivingLandlord(p.livingLandlord ? "true" : "false");
      if (p.rooms) setRooms(p.rooms);
    });
  }, [propertyId]);

  const isMultiple = original?.vacancyType === "MULTIPLE";

  const canSubmit = useMemo(() => !!selectedLandlordId, [selectedLandlordId]);

  async function handleSave() {
    if (!canSubmit || !original) return;
    setMessage(null);

    if (status === "AVAILABLE") {
      const missing: string[] = [];
      if (!propertyDescription.trim()) missing.push("description");
      if (!availabilityDate) missing.push("availability date");
      if (selectedAssets.length === 0) missing.push("at least one photo");
      if (missing.length > 0) {
        setMessage({ type: "error", text: `Cannot publish. Please fill in: ${missing.join(", ")}.` });
        return;
      }
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      landlordId: selectedLandlordId !== original.landlordId ? selectedLandlordId : undefined,
      propertyRef: propertyRef.trim() || undefined,
      title: propertyTitle.trim() || null,
      description: propertyDescription.trim() || null,
      status,
      propertyType: propertyType.trim() || null,
      beds: beds !== "" ? Number(beds) : null,
      baths: baths !== "" ? Number(baths) : null,
      totalRooms: totalRooms !== "" ? Number(totalRooms) : null,
      availableRooms: availableRooms !== "" ? Number(availableRooms) : null,
      rentPerMonth: rentPerMonth !== "" ? Number(rentPerMonth) : null,
      depositAmount: depositAmount !== "" ? Number(depositAmount) : null,
      isFurnished: isFurnished === "true",
      personsAllowed: personsAllowed !== "" ? Number(personsAllowed) : null,
      petsAllowed: petsAllowed === "true",
      dssAllowed: dssAllowed === "true",
      childrenAllowed: childrenAllowed === "true",
      availabilityDate: availabilityDate ? new Date(availabilityDate).toISOString() : null,
      livingLandlord: livingLandlord === "true",
      mediaAssets: selectedAssets.map((a) => ({ id: a.mediaAssetId, altText: a.altText })),
    };

    if (!isMultiple) {
      payload.landlordDemand = landlordDemand !== "" ? Number(landlordDemand) : null;
      if (commissionType === "pct") {
        payload.expectedCommissionPct = commissionPct !== "" ? Number(commissionPct) : null;
        payload.expectedCommissionAmt = null;
      } else {
        payload.expectedCommissionAmt = commissionAmt !== "" ? Number(commissionAmt) : null;
        payload.expectedCommissionPct = null;
      }
    }

    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    );

    const result = await updateProperty(propertyId, cleanPayload);
    setSaving(false);

    if (!result.ok) {
      // If nothing changed and we're saving a draft, treat as success
      if (result.error === "NO_FIELDS_TO_UPDATE" && status === "DRAFT") {
        setMessage({ type: "success", text: "Property draft is up to date." });
        return;
      }
      setMessage({ type: "error", text: result.message ?? "Failed to save property." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Changes submitted for admin approval.",
      });
      return;
    }

    setMessage({ type: "success", text: "Property updated." });
    setTimeout(() => router.push(detailHref), 800);
  }

  async function handleAddRoom() {
    if (!newRoom.roomName.trim()) return;
    setAddingRoom(true);
    const result = await addPropertyRoom(propertyId, {
      roomName: newRoom.roomName.trim(),
      landlordDemand: newRoom.landlordDemand !== "" ? Number(newRoom.landlordDemand) : undefined,
      expectedCommissionPct: newRoom.expectedCommissionPct !== "" ? Number(newRoom.expectedCommissionPct) : undefined,
    });
    setAddingRoom(false);
    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to add room." });
      return;
    }
    setRooms((prev) => [...prev, result.data.room as unknown as RoomRow]);
    setNewRoom({ roomName: ROOM_TYPES[0], landlordDemand: "", expectedCommissionPct: "" });
    setMessage({ type: "success", text: "Room added." });
  }

  function updateRoomField(
    roomId: string,
    key: keyof Pick<RoomRow, "roomName" | "landlordDemand" | "expectedCommissionPct">,
    value: string,
  ) {
    setRooms((prev) =>
      prev.map((room) =>
        room.id === roomId ? { ...room, [key]: value } : room,
      ),
    );
  }

  async function handleSaveRoom(room: RoomRow) {
    setRoomBusyId(room.id);
    setMessage(null);

    const result = await updatePropertyRoom(propertyId, room.id, {
      roomName: room.roomName.trim(),
      landlordDemand:
        room.landlordDemand !== "" && room.landlordDemand != null ? Number(room.landlordDemand) : null,
      expectedCommissionPct:
        room.expectedCommissionPct !== "" && room.expectedCommissionPct != null
          ? Number(room.expectedCommissionPct)
          : null,
    });

    setRoomBusyId(null);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to update room." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Room changes submitted for admin approval.",
      });
      return;
    }

    if (result.data.room) {
      setRooms((prev) =>
        prev.map((item) => (item.id === room.id ? (result.data.room as unknown as RoomRow) : item)),
      );
    }
    setMessage({ type: "success", text: result.data.message ?? "Room updated." });
  }

  async function handleDeleteRoom(room: RoomRow) {
    if (!window.confirm(`Remove "${room.roomName}" from this property?`)) return;

    setDeletingRoomId(room.id);
    setMessage(null);

    const result = await deletePropertyRoom(propertyId, room.id);
    setDeletingRoomId(null);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to delete room." });
      return;
    }

    if (result.data.approvalRequired) {
      setMessage({
        type: "success",
        text: result.data.message ?? "Room deletion submitted for admin approval.",
      });
      return;
    }

    setRooms((prev) => prev.filter((item) => item.id !== room.id));
    setMessage({ type: "success", text: result.data.message ?? "Room deleted." });
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        Loading property...
      </div>
    );
  }

  if (!original) {
    return <UIAlert type="error">Property not found or access denied.</UIAlert>;
  }

  const fullAddress = [original.addressLine1, original.addressLine2, original.city, original.county, original.postcode]
    .filter(Boolean).join(", ");

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">Edit Property</h1>
          <p className="page-subtitle">{fullAddress || original.propertyRef}</p>
        </div>
        <UIButton variant="secondary" onClick={() => router.push(detailHref)}>
          Back to Property
        </UIButton>
      </header>

      {message && <UIAlert type={message.type}>{message.text}</UIAlert>}

      <UICard>
        <UICardBody>
          <div className="field-grid">

            {/* Address display (read-only) */}
            <div className="form-section-divider">
              <span className="form-section-label">Address (read-only)</span>
            </div>
            <div style={{ padding: "0.75rem 1rem", background: "var(--surface-alt, #1a1a24)", borderRadius: "0.5rem", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {fullAddress || "No address recorded"}
            </div>

            {/* Landlord */}
            <div className="form-section-divider">
              <span className="form-section-label">Landlord</span>
            </div>

            <label className="field">
              <span className="label">Landlord <span style={{ color: "var(--danger)" }}>*</span></span>
              <UISelect
                value={selectedLandlordId}
                onChange={(e) => setSelectedLandlordId(e.target.value)}
                disabled={saving}
              >
                <option value="">— Choose a landlord —</option>
                {landlords.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.landlordName} ({l.phoneLast10}){l.isPassive ? " [Passive]" : ""}
                  </option>
                ))}
              </UISelect>
            </label>

            {/* Status & Reference */}
            <div className="form-section-divider">
              <span className="form-section-label">Status & Reference</span>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Status</span>
                <UISelect value={status} onChange={(e) => setStatus(e.target.value as PropertyStatus)} disabled={saving}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </UISelect>
                {original.status === "CLOSED" && (
                  <span className="hint-text">Property is CLOSED — status can only be changed via close-sale.</span>
                )}
              </label>
              <label className="field">
                <span className="label">Property Reference</span>
                <UIInput value={propertyRef} onChange={(e) => setPropertyRef(e.target.value)} disabled={saving} />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Property Title</span>
                <UIInput
                  value={propertyTitle}
                  onChange={(e) => setPropertyTitle(e.target.value)}
                  placeholder="e.g. Spacious flat near transport links"
                  disabled={saving}
                />
              </label>
            </div>

            <label className="field">
              <span className="label">Property Description</span>
              <textarea
                className="textarea"
                value={propertyDescription}
                onChange={(e) => setPropertyDescription(e.target.value)}
                placeholder="Describe the property, nearby amenities, and any standout features."
                rows={5}
                disabled={saving}
              />
            </label>

            {/* Property Images — media library picker */}
            <div className="form-section-divider">
              <span className="form-section-label">Property Images</span>
            </div>

            <MediaLibraryPicker
              selectedAssets={selectedAssets}
              onChange={setSelectedAssets}
              disabled={saving}
              label="Property Photos"
            />

            {/* Property Details */}
            <div className="form-section-divider">
              <span className="form-section-label">Property Details</span>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Property Type</span>
                <UIInput value={propertyType} onChange={(e) => setPropertyType(e.target.value)} placeholder="e.g. House, Flat" disabled={saving} />
              </label>
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">Beds</span>
                  <UIInput type="number" min={0} step="1" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="e.g. 3" disabled={saving} />
                </label>
                <label className="field">
                  <span className="label">Baths</span>
                  <UIInput type="number" min={0} step="1" value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="e.g. 1" disabled={saving} />
                </label>
              </div>
            </div>

            {/* Occupancy */}
            <div className="form-section-divider">
              <span className="form-section-label">Occupancy Details</span>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Total Rooms</span>
                <UIInput type="number" min={0} step="1" value={totalRooms} onChange={(e) => setTotalRooms(e.target.value)} placeholder="e.g. 4" disabled={saving} />
              </label>
              <label className="field">
                <span className="label">Available Rooms</span>
                <UIInput type="number" min={0} step="1" value={availableRooms} onChange={(e) => setAvailableRooms(e.target.value)} placeholder="e.g. 2" disabled={saving} />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Rent / Month (£)</span>
                <UIInput type="number" min={0} step="0.01" value={rentPerMonth} onChange={(e) => setRentPerMonth(e.target.value)} placeholder="e.g. 1200" disabled={saving} />
              </label>
              <label className="field">
                <span className="label">Deposit (£)</span>
                <UIInput type="number" min={0} step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="e.g. 1500" disabled={saving} />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Furnished</span>
                <UISelect value={isFurnished} onChange={(e) => setIsFurnished(e.target.value as "true" | "false")} disabled={saving}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">Persons Allowed</span>
                <UIInput type="number" min={1} step="1" value={personsAllowed} onChange={(e) => setPersonsAllowed(e.target.value)} placeholder="e.g. 3" disabled={saving} />
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Pets Allowed</span>
                <UISelect value={petsAllowed} onChange={(e) => setPetsAllowed(e.target.value as "true" | "false")} disabled={saving}>
                  <option value="true">Yes</option><option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">DSS Allowed</span>
                <UISelect value={dssAllowed} onChange={(e) => setDssAllowed(e.target.value as "true" | "false")} disabled={saving}>
                  <option value="true">Yes</option><option value="false">No</option>
                </UISelect>
              </label>
            </div>

            <div className="field-grid-2">
              <label className="field">
                <span className="label">Children Allowed</span>
                <UISelect value={childrenAllowed} onChange={(e) => setChildrenAllowed(e.target.value as "true" | "false")} disabled={saving}>
                  <option value="true">Yes</option><option value="false">No</option>
                </UISelect>
              </label>
              <label className="field">
                <span className="label">Living Landlord</span>
                <UISelect value={livingLandlord} onChange={(e) => setLivingLandlord(e.target.value as "true" | "false")} disabled={saving}>
                  <option value="false">No</option><option value="true">Yes</option>
                </UISelect>
              </label>
            </div>

            <label className="field" style={{ maxWidth: "280px" }}>
              <span className="label">Availability Date</span>
              <UIInput type="date" value={availabilityDate} onChange={(e) => setAvailabilityDate(e.target.value)} disabled={saving} />
            </label>

            {/* Financial (single only) */}
            {!isMultiple && (
              <>
                <div className="form-section-divider">
                  <span className="form-section-label">Financial</span>
                </div>

                <div className="field-grid-2">
                  <label className="field">
                    <span className="label">Landlord Demand (£/mo)</span>
                    <UIInput type="number" min={0} step="0.01" value={landlordDemand} onChange={(e) => setLandlordDemand(e.target.value)} placeholder="e.g. 1200" disabled={saving} />
                  </label>
                  <label className="field">
                    <span className="label">
                      Expected Commission
                      <span style={{ display: "inline-flex", gap: "0.25rem", marginLeft: "0.5rem" }}>
                        {(["pct", "amt"] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setCommissionType(t)} disabled={saving}
                            style={{ fontSize: "0.72rem", fontWeight: 700, padding: "0.1rem 0.4rem", border: "1px solid var(--border)", borderRadius: "0.25rem",
                              background: commissionType === t ? "var(--brand-gold)" : "transparent",
                              color: commissionType === t ? "#000" : "var(--text-muted)", cursor: "pointer" }}>
                            {t === "pct" ? "%" : "£"}
                          </button>
                        ))}
                      </span>
                    </span>
                    {commissionType === "pct"
                      ? <UIInput type="number" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} min={0} max={9999} step="0.1" placeholder="e.g. 10" disabled={saving} />
                      : <UIInput type="number" value={commissionAmt} onChange={(e) => setCommissionAmt(e.target.value)} min={0} step="0.01" placeholder="e.g. 500" disabled={saving} />}
                  </label>
                </div>
              </>
            )}

            {/* Rooms (MULTIPLE only) */}
            {isMultiple && (
              <>
                <div className="form-section-divider">
                  <span className="form-section-label">Rooms</span>
                </div>

                <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: "0.5rem" }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Status</th>
                        <th>Demand (£)</th>
                        <th>Commission (%)</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rooms.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                            No rooms yet
                          </td>
                        </tr>
                      ) : (
                        rooms.map((room) => {
                          const roomBusy = roomBusyId === room.id;
                          const roomDeleting = deletingRoomId === room.id;

                          return (
                          <tr key={room.id}>
                            <td style={{ minWidth: "180px" }}>
                              <UIInput
                                value={room.roomName}
                                onChange={(e) => updateRoomField(room.id, "roomName", e.target.value)}
                                disabled={roomBusy || roomDeleting}
                              />
                              {room.sale ? (
                                <div className="hint-text" style={{ marginTop: "0.35rem" }}>
                                  Linked sale recorded for this room.
                                </div>
                              ) : null}
                            </td>
                            <td>
                              <span className={`badge ${room.status === "AVAILABLE" ? "badge-active" : room.status === "CLOSED" ? "badge-sold" : "badge-draft"}`}>
                                {room.status}
                              </span>
                            </td>
                            <td style={{ minWidth: "145px" }}>
                              <UIInput
                                type="number"
                                min={0}
                                step="0.01"
                                value={room.landlordDemand ?? ""}
                                onChange={(e) => updateRoomField(room.id, "landlordDemand", e.target.value)}
                                disabled={roomBusy || roomDeleting}
                              />
                            </td>
                            <td style={{ minWidth: "145px" }}>
                              <UIInput
                                type="number"
                                min={0}
                                step="0.1"
                                value={room.expectedCommissionPct ?? ""}
                                onChange={(e) => updateRoomField(room.id, "expectedCommissionPct", e.target.value)}
                                disabled={roomBusy || roomDeleting}
                              />
                            </td>
                            <td>
                              <div className="inline-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                                <UIButton
                                  type="button"
                                  variant="secondary"
                                  onClick={() => void handleSaveRoom(room)}
                                  disabled={roomBusy || roomDeleting}
                                >
                                  {roomBusy ? "Saving..." : "Save"}
                                </UIButton>
                                <UIButton
                                  type="button"
                                  variant="danger"
                                  onClick={() => void handleDeleteRoom(room)}
                                  disabled={roomBusy || roomDeleting || Boolean(room.sale)}
                                  title={room.sale ? "Rooms with a sale cannot be deleted." : "Delete room"}
                                >
                                  {roomDeleting ? "Deleting..." : "Delete"}
                                </UIButton>
                              </div>
                            </td>
                          </tr>
                        )})
                      )}
                      <tr style={{ background: "var(--surface-alt, #1a1a24)" }}>
                        <td>
                          <UISelect value={newRoom.roomName} onChange={(e) => setNewRoom((p) => ({ ...p, roomName: e.target.value }))} disabled={addingRoom}>
                            {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </UISelect>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>new</td>
                        <td>
                          <UIInput type="number" min={0} step="0.01" value={newRoom.landlordDemand} onChange={(e) => setNewRoom((p) => ({ ...p, landlordDemand: e.target.value }))} placeholder="Optional" disabled={addingRoom} />
                        </td>
                        <td>
                          <UIInput type="number" min={0} step="0.1" value={newRoom.expectedCommissionPct} onChange={(e) => setNewRoom((p) => ({ ...p, expectedCommissionPct: e.target.value }))} placeholder="Optional" disabled={addingRoom} />
                        </td>
                        <td>
                          <UIButton type="button" onClick={() => void handleAddRoom()} disabled={addingRoom || !newRoom.roomName.trim()}>
                            {addingRoom ? "Adding..." : "Add Room"}
                          </UIButton>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="inline-row" style={{ marginTop: "0.25rem" }}>
              <UIButton onClick={() => void handleSave()} disabled={!canSubmit || saving}>
                {saving ? "Saving..." : "Save Changes"}
              </UIButton>
              <UIButton variant="secondary" onClick={() => router.push(detailHref)} disabled={saving}>Cancel</UIButton>
            </div>

          </div>
        </UICardBody>
      </UICard>
    </div>
  );
}
