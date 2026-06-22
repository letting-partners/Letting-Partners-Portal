"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PropertyPreviewCard } from "@/components/property-preview-card";
import { UIAlert } from "@/components/ui/alert";
import { UIButton } from "@/components/ui/button";
import { UIInput } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { UISelect } from "@/components/ui/select";
import {
  reassignAgentRecords,
  type AgentTransferCategory,
  type AgentTransferEntityType,
  type AgentTransferSummary,
} from "@/lib/portal-api";
import { formatCurrency, formatDate } from "@/lib/format";

type TransferTarget = {
  id: string;
  agentDisplayName: string;
  email: string;
};

type PropertyRow = {
  id: string;
  propertyRef: string;
  title: string | null;
  description: string | null;
  addressLine1: string | null;
  city: string | null;
  postcode: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  status: "AVAILABLE" | "DRAFT" | "CLOSED";
  vacancyType: "SINGLE" | "MULTIPLE";
  createdAt: Date;
  images?: Array<{ id: string; name: string; imageUrl?: string; dataUrl?: string }>;
  landlord: { id: string; landlordName: string };
};

type LandlordRow = {
  id: string;
  landlordName: string;
  landlordNumber: string;
  email: string | null;
  phoneE164: string | null;
  createdAt: Date;
  _count: { properties: number };
};

type SaleRow = {
  id: string;
  finalAmount: number;
  commissionAmount: number;
  profit: number;
  closedAt: Date;
  property: {
    id: string;
    propertyRef: string;
    addressLine1: string | null;
    city: string | null;
    postcode: string | null;
  };
  tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    moveInDate: Date | null;
    rentAmount: number | null;
    depositAmount: number | null;
  } | null;
};

type TenantRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  moveInDate: Date | null;
  rentAmount: number | null;
  depositAmount: number | null;
  createdAt: Date;
  sale: {
    property: {
      id: string;
      propertyRef: string;
      addressLine1: string | null;
      city: string | null;
      postcode: string | null;
    };
  } | null;
};

type PotentialTenantRow = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  interestedIn: string | null;
  budget: string | null;
  createdAt: Date;
};

type PotentialLandlordRow = {
  id: string;
  fullName: string;
  phoneLast10: string;
  createdAt: Date;
};

type TabKey =
  | "properties"
  | "landlords"
  | "tenants"
  | "sales"
  | "potentialTenants"
  | "potentialLandlords";

type TransferDialogState = {
  entityType: AgentTransferEntityType;
  entityId: string;
  label: string;
  helperText: string;
};

type Props = {
  sourceAgentId: string;
  sourceAgentName: string;
  transferTargets: TransferTarget[];
  properties: PropertyRow[];
  landlords: LandlordRow[];
  tenants: TenantRow[];
  sales: SaleRow[];
  potentialTenants: PotentialTenantRow[];
  potentialLandlords: PotentialLandlordRow[];
};

const TAB_LABELS: Record<TabKey, string> = {
  properties: "Properties",
  landlords: "Landlords",
  tenants: "Tenants",
  sales: "Sales",
  potentialTenants: "Potential Tenants",
  potentialLandlords: "Potential Landlords",
};

const TRANSFER_CATEGORY_LABELS: Record<AgentTransferCategory, string> = {
  LANDLORDS: "Landlords",
  PROPERTIES: "Properties",
  TENANTS: "Tenants",
  POTENTIAL_TENANTS: "Potential Tenants",
  POTENTIAL_LANDLORDS: "Potential Landlords",
};

const DEFAULT_BULK_CATEGORIES: AgentTransferCategory[] = [
  "LANDLORDS",
  "PROPERTIES",
  "TENANTS",
  "POTENTIAL_TENANTS",
  "POTENTIAL_LANDLORDS",
];

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function summarizeTransfer(summary: AgentTransferSummary) {
  const parts: string[] = [];

  if (summary.landlordsMoved > 0) parts.push(`${summary.landlordsMoved} ${pluralize(summary.landlordsMoved, "landlord")}`);
  if (summary.propertiesMoved > 0) parts.push(`${summary.propertiesMoved} ${pluralize(summary.propertiesMoved, "property")}`);
  if (summary.standaloneTenantsMoved > 0) parts.push(`${summary.standaloneTenantsMoved} standalone ${pluralize(summary.standaloneTenantsMoved, "tenant")}`);
  if (summary.potentialTenantsMoved > 0) parts.push(`${summary.potentialTenantsMoved} potential ${pluralize(summary.potentialTenantsMoved, "tenant")}`);
  if (summary.potentialLandlordsMoved > 0) parts.push(`${summary.potentialLandlordsMoved} potential ${pluralize(summary.potentialLandlordsMoved, "landlord")}`);
  if (summary.linkedSaleTenantsAffected > 0) parts.push(`${summary.linkedSaleTenantsAffected} sale-linked ${pluralize(summary.linkedSaleTenantsAffected, "tenant")} followed via property ownership`);
  if (summary.skippedProperties > 0) parts.push(`${summary.skippedProperties} ${pluralize(summary.skippedProperties, "property")} skipped`);
  if (summary.skippedTenants > 0) parts.push(`${summary.skippedTenants} ${pluralize(summary.skippedTenants, "tenant")} skipped`);

  return parts.join(" | ");
}

export function AgentReportClient({
  sourceAgentId,
  sourceAgentName,
  transferTargets,
  properties,
  landlords,
  tenants,
  sales,
  potentialTenants,
  potentialLandlords,
}: Props) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [tab, setTab] = useState<TabKey>("properties");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [bulkTargetAgentId, setBulkTargetAgentId] = useState(transferTargets[0]?.id ?? "");
  const [bulkReason, setBulkReason] = useState("");
  const [bulkCategories, setBulkCategories] = useState<AgentTransferCategory[]>(DEFAULT_BULK_CATEGORIES);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [transferDialog, setTransferDialog] = useState<TransferDialogState | null>(null);
  const [singleTargetAgentId, setSingleTargetAgentId] = useState(transferTargets[0]?.id ?? "");
  const [singleReason, setSingleReason] = useState("");
  const [singleBusy, setSingleBusy] = useState(false);

  const standaloneTenantsCount = useMemo(
    () => tenants.filter((tenant) => tenant.sale == null).length,
    [tenants],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const includesQuery = (value: Array<string | null | undefined>) =>
      value.filter(Boolean).join(" ").toLowerCase().includes(query);

    switch (tab) {
      case "properties":
        return properties.filter((row) =>
          includesQuery([
            row.propertyRef,
            row.title,
            row.description,
            row.addressLine1,
            row.city,
            row.postcode,
            row.propertyType,
            row.landlord.landlordName,
          ]),
        );
      case "landlords":
        return landlords.filter((row) =>
          includesQuery([row.landlordName, row.landlordNumber, row.email, row.phoneE164]),
        );
      case "tenants":
        return tenants.filter((row) =>
          includesQuery([row.fullName, row.email, row.phone, row.sale?.property.propertyRef, row.sale?.property.addressLine1]),
        );
      case "sales":
        return sales.filter((row) =>
          includesQuery([row.property.propertyRef, row.property.addressLine1, row.property.city, row.property.postcode, row.tenant?.fullName]),
        );
      case "potentialTenants":
        return potentialTenants.filter((row) =>
          includesQuery([row.fullName, row.email, row.phone, row.interestedIn, row.budget]),
        );
      case "potentialLandlords":
        return potentialLandlords.filter((row) =>
          includesQuery([row.fullName, row.phoneLast10]),
        );
      default:
        return [];
    }
  }, [landlords, potentialLandlords, potentialTenants, properties, sales, search, tab, tenants]);

  const totalPages = filteredRows.length === 0 ? 0 : Math.ceil(filteredRows.length / pageSize);
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const hasTargets = transferTargets.length > 0;

  function switchTab(nextTab: TabKey) {
    setTab(nextTab);
    setSearch("");
    setPage(1);
  }

  function toggleBulkCategory(category: AgentTransferCategory) {
    setBulkCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  }

  function openTransferDialog(dialog: TransferDialogState) {
    setTransferDialog(dialog);
    setSingleTargetAgentId(transferTargets[0]?.id ?? "");
    setSingleReason("");
  }

  async function handleBulkTransfer() {
    if (!hasTargets) {
      setMessage({ type: "error", text: "No active target agent is available." });
      return;
    }

    if (!bulkTargetAgentId) {
      setMessage({ type: "error", text: "Choose the agent who should receive the records." });
      return;
    }

    if (bulkCategories.length === 0) {
      setMessage({ type: "error", text: "Select at least one category to transfer." });
      return;
    }

    if (bulkReason.trim().length < 3) {
      setMessage({ type: "error", text: "Add a short reason so the reassignment is clearly tracked." });
      return;
    }

    setBulkBusy(true);
    setMessage(null);

    const result = await reassignAgentRecords(sourceAgentId, {
      mode: "BULK",
      targetAgentId: bulkTargetAgentId,
      categories: bulkCategories,
      reason: bulkReason.trim(),
    });

    setBulkBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to transfer records." });
      return;
    }

    const summaryText = summarizeTransfer(result.data.summary);
    const warningText = result.data.summary.warnings.length > 0 ? ` Warning: ${result.data.summary.warnings.join(" ")}` : "";

    setMessage({
      type: "success",
      text: `${result.data.message}${summaryText ? ` ${summaryText}.` : ""}${warningText}`,
    });
    setBulkReason("");
    startRefresh(() => router.refresh());
  }

  async function handleSingleTransfer() {
    if (!transferDialog) {
      return;
    }

    if (!hasTargets) {
      setMessage({ type: "error", text: "No active target agent is available." });
      return;
    }

    if (!singleTargetAgentId) {
      setMessage({ type: "error", text: "Choose the agent who should receive this record." });
      return;
    }

    if (singleReason.trim().length < 3) {
      setMessage({ type: "error", text: "Add a short reason so the reassignment is clearly tracked." });
      return;
    }

    setSingleBusy(true);
    setMessage(null);

    const result = await reassignAgentRecords(sourceAgentId, {
      mode: "SINGLE",
      targetAgentId: singleTargetAgentId,
      entityType: transferDialog.entityType,
      entityId: transferDialog.entityId,
      reason: singleReason.trim(),
    });

    setSingleBusy(false);

    if (!result.ok) {
      setMessage({ type: "error", text: result.message ?? "Failed to transfer the record." });
      return;
    }

    const summaryText = summarizeTransfer(result.data.summary);
    const warningText = result.data.summary.warnings.length > 0 ? ` Warning: ${result.data.summary.warnings.join(" ")}` : "";

    setTransferDialog(null);
    setSingleReason("");
    setMessage({
      type: "success",
      text: `${result.data.message}${summaryText ? ` ${summaryText}.` : ""}${warningText}`,
    });
    startRefresh(() => router.refresh());
  }

  const renderedTable = (() => {
    switch (tab) {
      case "properties":
        return (
          <div style={{ padding: "1.25rem" }}>
            <div className="property-card-grid">
              {(visibleRows as PropertyRow[]).map((property) => (
                <PropertyPreviewCard
                  key={property.id}
                  href={`/admin/properties/${property.id}`}
                  property={property}
                  landlord={{
                    label: "Landlord",
                    name: property.landlord.landlordName,
                    href: `/landlords/${property.landlord.id}`,
                  }}
                  footer={(
                    <>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        Added {formatDate(property.createdAt)}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                        onClick={() =>
                          openTransferDialog({
                            entityType: "PROPERTY",
                            entityId: property.id,
                            label: property.title ?? property.addressLine1 ?? property.propertyRef,
                            helperText: "If this property shares its landlord with other properties, transfer the landlord instead so ownership stays aligned.",
                          })
                        }
                        disabled={!hasTargets || isRefreshing}
                      >
                        Transfer
                      </button>
                    </>
                  )}
                />
              ))}
            </div>
          </div>
        );
      case "landlords":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Number</th>
                <th>Contact</th>
                <th>Properties</th>
                <th>Added</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {(visibleRows as LandlordRow[]).map((landlord) => (
                <tr key={landlord.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/landlords/${landlord.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {landlord.landlordName}
                    </Link>
                  </td>
                  <td><code>{landlord.landlordNumber}</code></td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {landlord.email && <span style={{ display: "block" }}>{landlord.email}</span>}
                    {landlord.phoneE164 && <span>{landlord.phoneE164}</span>}
                  </td>
                  <td style={{ fontWeight: 700, color: "var(--brand-gold)" }}>{landlord._count.properties}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(landlord.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                      onClick={() =>
                        openTransferDialog({
                          entityType: "LANDLORD",
                          entityId: landlord.id,
                          label: landlord.landlordName,
                          helperText: "Landlord transfer also moves all properties linked to that landlord.",
                        })
                      }
                      disabled={!hasTargets || isRefreshing}
                    >
                      Transfer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "tenants":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Contact</th>
                <th>Property</th>
                <th>Move-In</th>
                <th>Rent / Deposit</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {(visibleRows as TenantRow[]).map((tenant) => (
                <tr key={tenant.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/admin/tenants/${tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {tenant.fullName}
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {tenant.email && <span style={{ display: "block" }}>{tenant.email}</span>}
                    {tenant.phone && <span>{tenant.phone}</span>}
                  </td>
                  <td>
                    {tenant.sale?.property ? (
                      <Link href={`/admin/properties/${tenant.sale.property.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                        {tenant.sale.property.addressLine1 ?? tenant.sale.property.propertyRef}
                      </Link>
                    ) : (
                      <span className="muted">No property</span>
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {tenant.moveInDate ? formatDate(tenant.moveInDate) : "-"}
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {tenant.rentAmount ? `GBP ${tenant.rentAmount}/mo` : "-"}
                    {tenant.depositAmount ? (
                      <span style={{ display: "block", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                        dep: GBP {tenant.depositAmount}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {tenant.sale?.property ? (
                      <Link
                        href={`/admin/properties/${tenant.sale.property.id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                      >
                        Via Property
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                        onClick={() =>
                          openTransferDialog({
                            entityType: "TENANT",
                            entityId: tenant.id,
                            label: tenant.fullName,
                            helperText: "Only standalone tenants can be moved directly. Sale-linked tenants follow the property owner.",
                          })
                        }
                        disabled={!hasTargets || isRefreshing}
                      >
                        Transfer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "sales":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Sale Amount</th>
                <th>Commission</th>
                <th>Net Profit</th>
                <th>Tenant</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {(visibleRows as SaleRow[]).map((sale) => (
                <tr key={sale.id}>
                  <td>
                    <Link href={`/admin/sales/${sale.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none", fontWeight: 600 }}>
                      {sale.property.addressLine1 ?? sale.property.propertyRef}
                    </Link>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {[sale.property.city, sale.property.postcode].filter(Boolean).join(", ")}
                    </span>
                  </td>
                  <td style={{ color: "#4ade80", fontWeight: 700 }}>{formatCurrency(sale.finalAmount)}</td>
                  <td style={{ color: "var(--brand-gold)", fontWeight: 700 }}>{formatCurrency(sale.commissionAmount)}</td>
                  <td style={{ color: "#22d3ee", fontWeight: 700 }}>{formatCurrency(sale.profit)}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    {sale.tenant ? (
                      <Link href={`/admin/tenants/${sale.tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                        {sale.tenant.fullName}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(sale.closedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "potentialTenants":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Interested In</th>
                <th>Budget</th>
                <th>Added</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {(visibleRows as PotentialTenantRow[]).map((tenant) => (
                <tr key={tenant.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/admin/potential-tenants/${tenant.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {tenant.fullName}
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    {tenant.email && <span style={{ display: "block" }}>{tenant.email}</span>}
                    {tenant.phone && <span>{tenant.phone}</span>}
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{tenant.interestedIn ?? "-"}</td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{tenant.budget ?? "-"}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(tenant.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                      onClick={() =>
                        openTransferDialog({
                          entityType: "POTENTIAL_TENANT",
                          entityId: tenant.id,
                          label: tenant.fullName,
                          helperText: "This will reassign the potential tenant record to another agent.",
                        })
                      }
                      disabled={!hasTargets || isRefreshing}
                    >
                      Transfer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "potentialLandlords":
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Added</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {(visibleRows as PotentialLandlordRow[]).map((landlord) => (
                <tr key={landlord.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link href={`/admin/potential-landlords/${landlord.id}`} style={{ color: "var(--brand-gold)", textDecoration: "none" }}>
                      {landlord.fullName}
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>+44{landlord.phoneLast10}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(landlord.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: "0.76rem", padding: "0.3rem 0.6rem" }}
                      onClick={() =>
                        openTransferDialog({
                          entityType: "POTENTIAL_LANDLORD",
                          entityId: landlord.id,
                          label: landlord.fullName,
                          helperText: "This will reassign the potential landlord record to another agent.",
                        })
                      }
                      disabled={!hasTargets || isRefreshing}
                    >
                      Transfer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="stack">
      {message ? <UIAlert type={message.type}>{message.text}</UIAlert> : null}

      <div className="admin-card" id="reassignment-tools">
        <div className="admin-card-header">
          <div>
            <h2 className="admin-card-title">Reassign Records</h2>
            <p className="page-subtitle" style={{ margin: "0.35rem 0 0" }}>
              Admins can transfer records from active or disabled agents here, as long as the receiving agent account is active.
            </p>
          </div>
        </div>

        <div className="admin-card-body">
          {!hasTargets ? (
            <UIAlert type="error">Create or enable another active agent before using reassignment.</UIAlert>
          ) : (
            <div className="field-grid">
              <div className="field-grid-2">
                <label className="field">
                  <span className="label">From Agent</span>
                  <UIInput value={sourceAgentName} disabled />
                </label>
                <label className="field">
                  <span className="label">To Agent</span>
                  <UISelect
                    value={bulkTargetAgentId}
                    onChange={(event) => setBulkTargetAgentId(event.target.value)}
                    disabled={bulkBusy || isRefreshing}
                  >
                    <option value="">Choose target agent</option>
                    {transferTargets.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.agentDisplayName} ({agent.email})
                      </option>
                    ))}
                  </UISelect>
                </label>
              </div>

              <label className="field">
                <span className="label">Reason</span>
                <UIInput
                  value={bulkReason}
                  onChange={(event) => setBulkReason(event.target.value)}
                  placeholder="Example: agent left the company, temporary cover, or territory change"
                  disabled={bulkBusy || isRefreshing}
                />
              </label>

              <div className="field">
                <span className="label">Categories</span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "0.75rem",
                  }}
                >
                  {DEFAULT_BULK_CATEGORIES.map((category) => {
                    const count =
                      category === "LANDLORDS"
                        ? landlords.length
                        : category === "PROPERTIES"
                          ? properties.length
                          : category === "TENANTS"
                            ? standaloneTenantsCount
                            : category === "POTENTIAL_TENANTS"
                              ? potentialTenants.length
                              : potentialLandlords.length;

                    const note =
                      category === "LANDLORDS"
                        ? "Includes linked properties"
                        : category === "PROPERTIES"
                          ? "Moves properties where landlord ownership can stay aligned"
                          : category === "TENANTS"
                            ? "Standalone tenants only"
                            : "Direct reassignment";

                    return (
                      <label
                        key={category}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "0.6rem",
                          padding: "0.8rem 0.9rem",
                          border: "1px solid var(--border)",
                          borderRadius: "0.75rem",
                          background: "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={bulkCategories.includes(category)}
                          onChange={() => toggleBulkCategory(category)}
                          disabled={bulkBusy || isRefreshing}
                          style={{ marginTop: "0.2rem" }}
                        />
                        <span>
                          <span style={{ display: "block", fontWeight: 700, color: "var(--text)" }}>
                            {TRANSFER_CATEGORY_LABELS[category]} ({count})
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{note}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.8rem", alignItems: "center" }}>
                <UIButton
                  onClick={() => void handleBulkTransfer()}
                  disabled={bulkBusy || isRefreshing || !hasTargets}
                >
                  {bulkBusy || isRefreshing ? "Transferring..." : "Transfer Selected Records"}
                </UIButton>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBulkCategories(DEFAULT_BULK_CATEGORIES)}
                  disabled={bulkBusy || isRefreshing}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setBulkCategories([])}
                  disabled={bulkBusy || isRefreshing}
                >
                  Clear
                </button>
              </div>

              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                <div>Landlord transfers also move linked properties so ownership stays aligned.</div>
                <div>Sale-linked tenants follow property ownership automatically and are not transferred as standalone tenant records.</div>
                <div>Single-property transfer is only available when the linked landlord can stay aligned with the new owner.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header" style={{ flexDirection: "column", alignItems: "stretch", gap: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {(Object.keys(TAB_LABELS) as TabKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`btn ${tab === key ? "btn-primary" : "btn-secondary"}`}
                onClick={() => switchTab(key)}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>

          <label className="field" style={{ marginBottom: 0 }}>
            <span className="label">Search {TAB_LABELS[tab]}</span>
            <UIInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${TAB_LABELS[tab].toLowerCase()}`}
            />
          </label>
        </div>

        <div className="admin-card-body" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ borderRadius: 0, border: "none" }}>
            {renderedTable}
          </div>

          {visibleRows.length === 0 ? (
            <div style={{ padding: "1rem 1.25rem", borderTop: "1px solid var(--border)" }}>
              <p className="muted" style={{ margin: 0 }}>
                No {TAB_LABELS[tab].toLowerCase()} match your search.
              </p>
            </div>
          ) : null}
        </div>

        <div style={{ padding: "0 1.25rem 1.25rem" }}>
          <PaginationControls
            page={page}
            pageSize={pageSize}
            total={filteredRows.length}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      </div>

      {transferDialog ? (
        <div
          className="modal-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !singleBusy) {
              setTransferDialog(null);
            }
          }}
        >
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div className="modal-head">
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
                Transfer {transferDialog.label}
              </h3>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {transferDialog.helperText}
              </p>
            </div>

            <div className="modal-body" style={{ display: "grid", gap: "1rem" }}>
              <label className="field">
                <span className="label">To Agent</span>
                <UISelect
                  value={singleTargetAgentId}
                  onChange={(event) => setSingleTargetAgentId(event.target.value)}
                  disabled={singleBusy}
                >
                  <option value="">Choose target agent</option>
                  {transferTargets.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.agentDisplayName} ({agent.email})
                    </option>
                  ))}
                </UISelect>
              </label>

              <label className="field">
                <span className="label">Reason</span>
                <UIInput
                  value={singleReason}
                  onChange={(event) => setSingleReason(event.target.value)}
                  placeholder="Why is this record being transferred?"
                  disabled={singleBusy}
                />
              </label>
            </div>

            <div className="modal-foot">
              <UIButton
                type="button"
                variant="secondary"
                onClick={() => setTransferDialog(null)}
                disabled={singleBusy}
              >
                Cancel
              </UIButton>
              <UIButton
                type="button"
                onClick={() => void handleSingleTransfer()}
                disabled={singleBusy}
              >
                {singleBusy ? "Transferring..." : "Confirm Transfer"}
              </UIButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
