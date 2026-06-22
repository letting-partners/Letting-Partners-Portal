import { apiDelete, apiGet, apiPatch, apiPost, type ApiResult } from "./api-client";
import { normalizePhoneNo, normalizePostcode } from "./normalize";

export type SessionRole = "ADMIN" | "AGENT";

export type PropertyStatus = "DRAFT" | "AVAILABLE" | "CLOSED";
export type VacancyType = "SINGLE" | "MULTIPLE";
export type RoomStatus = "AVAILABLE" | "UNDER_OFFER" | "CLOSED";

export type WorkflowCallOutcome = "CONFIRMED" | "FOLLOW_UP" | "NOT_INTERESTED";

export type DialingArea = "AREA_1" | "AREA_2" | "AREA_3" | "AREA_4" | "AREA_5";

export type PropertyMediaSelection = {
  mediaAssetId: string;
  altText: string;
};

export type PotentialLandlordRow = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phoneNo: string;
  phoneE164: string | null;
  phoneLast10: string;
  email: string | null;
  notes: string | null;
  followUpAt: string | null;
  lockUntil: string | null;
  canContinue: boolean;
  continuationLeadId: string | null;
  createdAt: string;
  updatedAt: string;
  addedByAgent: {
    id: string;
    agentDisplayName: string;
  };
};

export type PotentialTenantRow = {
  id: string;
  fullName: string;
  email: string | null;
  phoneNo: string | null;
  currentAddress: string | null;
  currentPostcode: string | null;
  preferredPostcode: string | null;
  interestedIn: string | null;
  budget: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  addedByAgent: {
    id: string;
    agentDisplayName: string;
  };
};

export type WorkflowCallRecordRow = {
  id: string;
  phoneNo: string;
  outcome: WorkflowCallOutcome;
  landlordName: string | null;
  landlordId: string | null;
  propertyId: string | null;
  propertyRef: string | null;
  followUpAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  agent: {
    id: string;
    agentDisplayName: string;
    email: string;
  };
};

export type DailyReportSummaryRow = {
  id: string;
  reportDate: string;
  agent?: {
    id: string;
    agentDisplayName: string;
    email: string;
  };
  dialingArea: DialingArea | null;
  callsMade: number;
  callsConnected: number;
  callsFailed: number;
  landlordConfirm: number;
  viewingsArranged: number;
  successfulViewings: number;
  followUp: number;
  reSchedule: number;
  notes: string | null;
  createdAt: string;
};

export type TenantRow = {
  id: string;
  saleId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  currentAddress: string | null;
  moveInDate: string | null;
  rentAmount: string | null;
  depositAmount: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleRow = {
  id: string;
  propertyId: string;
  roomId?: string | null;
  closedByUserId: string;
  finalAmount: string;
  commissionPct: string;
  commissionAmount: string;
  otherCosts: string | null;
  profit: string;
  closedAt: string;
  tenant?: TenantRow | null;
};

export type PropertyRoomRow = {
  id: string;
  propertyId: string;
  roomName: string;
  landlordDemand: string | null;
  expectedCommissionPct: string | null;
  status: RoomStatus;
  createdAt: string;
  sale?: {
    id: string;
    finalAmount: string;
    commissionAmount: string;
    profit: string;
    closedAt: string;
    tenant?: { id: string; fullName: string } | null;
  } | null;
};

export type MediaAssetRow = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl?: string;   // only present in upload (POST) responses
  imageUrl: string;   // always present — use for <img src>
  createdAt: string;
  uploadedBy?: {
    id: string;
    agentDisplayName: string;
    email: string;
  } | null;
};

export type LandlordRow = {
  id: string;
  landlordName: string;
  landlordNumber: string;
  phoneE164: string | null;
  phoneLast10: string;
  email: string | null;
  notes: string | null;
  isPassive?: boolean;
  passiveMarkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerAgent: {
    id: string;
    agentDisplayName: string;
  };
  _count?: {
    properties: number;
  };
};

export type LandlordDetails = {
  id: string;
  landlordName: string;
  landlordNumber: string;
  phoneE164: string | null;
  phoneLast10: string;
  email: string | null;
  notes: string | null;
  isPassive?: boolean;
  passiveMarkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  updatedByUserId: string;
  ownerAgentId: string;
  ownerAgent: {
    id: string;
    agentDisplayName: string;
  };
  _count?: {
    properties: number;
  };
  canEdit: boolean;
};

export type PropertyRow = {
  id: string;
  landlordId: string;
  ownerAgentId: string;
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
  vacancyType?: VacancyType;
  landlordDemand: string | null;
  expectedCommissionPct: string | null;
  expectedCommissionAmt: string | null;
  totalRooms: number | null;
  availableRooms: number | null;
  rentPerMonth: string | null;
  depositAmount: string | null;
  isFurnished: boolean | null;
  personsAllowed: number | null;
  petsAllowed: boolean | null;
  dssAllowed: boolean | null;
  childrenAllowed: boolean | null;
  availabilityDate: string | null;
  livingLandlord: boolean | null;
  publishedToWebsite?: boolean;
  createdAt: string;
  updatedAt: string;
  ownerAgent?: {
    id: string;
    agentDisplayName: string;
    email?: string;
  };
  images?: MediaAssetRow[];
  sales?: SaleRow[];
  rooms?: PropertyRoomRow[];
  // Backward compatibility for legacy screens still expecting one sale.
  sale?: SaleRow | null;
};

export type AgentRow = {
  id: string;
  email: string;
  agentDisplayName: string;
  profilePicture?: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: {
    ownedLandlords: number;
    ownedProperties: number;
  };
};

export type AgentTransferCategory =
  | "LANDLORDS"
  | "PROPERTIES"
  | "TENANTS"
  | "POTENTIAL_TENANTS"
  | "POTENTIAL_LANDLORDS";

export type AgentTransferEntityType =
  | "LANDLORD"
  | "PROPERTY"
  | "TENANT"
  | "POTENTIAL_TENANT"
  | "POTENTIAL_LANDLORD";

export type AgentTransferSummary = {
  landlordsMoved: number;
  propertiesMoved: number;
  standaloneTenantsMoved: number;
  potentialTenantsMoved: number;
  potentialLandlordsMoved: number;
  linkedSaleTenantsAffected: number;
  skippedProperties: number;
  skippedTenants: number;
  warnings: string[];
};

export type AuditLogRow = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  metadata: unknown;
  beforeJson: unknown;
  afterJson: unknown;
  createdAt: string;
  user: {
    id: string;
    email: string;
    agentDisplayName: string;
    role: SessionRole;
  };
};

export type AuditLogListResponse = {
  logs: AuditLogRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ApprovalRow = {
  id: string;
  entityType: "LANDLORD" | "PROPERTY" | "TENANT" | "POTENTIAL_TENANT" | "POTENTIAL_LANDLORD";
  entityId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  summary: string | null;
  beforeJson: unknown;
  proposedJson: unknown;
  reviewerNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
  requestedBy: {
    id: string;
    email: string;
    agentDisplayName: string;
  };
  reviewedBy: {
    id: string;
    email: string;
    agentDisplayName: string;
  } | null;
};

export type ApprovalListResponse = {
  approvals: ApprovalRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DialerDomainConfigRow = {
  id: string;
  dialerMode: "SIP" | "LINKUS";
  linkusWebClientUrl: string | null;
  pbxPlatform: string | null;
  domain: string | null;
  sipPort: number | null;
  sipTransport: string | null;
  websocketHost: string | null;
  isEnabled: boolean;
  updatedAt: string | null;
  updatedBy?: {
    id: string;
    agentDisplayName: string;
    email: string;
  } | null;
};

export type AdminAgentDialerSettings = {
  id: string;
  email: string;
  agentDisplayName: string;
  isActive: boolean;
  createdAt: string;
  dialer: {
    extensionNumber: string | null;
    extensionName: string | null;
    providerUsername: string | null;
    autoDetectExtension: boolean;
    hasProviderPassword: boolean;
    updatedAt: string | null;
  };
};

export type DialerLabelRow = {
  id: string;
  name: string;
  colorHex: string;
  createdAt: string;
  updatedAt: string;
  contactsCount: number;
};

export type DialerContactRow = {
  id: string;
  fullName: string;
  phoneNumber: string;
  extensionNumber: string | null;
  email: string | null;
  notes: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  labels: Array<{
    id: string;
    name: string;
    colorHex: string;
  }>;
};

export type DialerCallHistoryRow = {
  id: string;
  direction: "INCOMING" | "OUTGOING" | "INTERNAL";
  status: "MISSED" | "RINGING" | "ANSWERED" | "REJECTED" | "COMPLETED" | "FAILED";
  peerName: string | null;
  peerNumber: string | null;
  peerExtension: string | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number;
  recordingUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  contact: {
    id: string;
    fullName: string;
    phoneNumber: string;
    extensionNumber: string | null;
  } | null;
  counterpartUser: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type DialerBootstrapResponse = {
  dialerDomain: {
    dialerMode: "SIP" | "LINKUS";
    linkusWebClientUrl: string | null;
    domain: string | null;
    websocketHost: string | null;
    isEnabled: boolean;
    updatedAt: string | null;
  };
  me: {
    id: string;
    email: string;
    name: string;
    role: SessionRole;
    dialer: {
      extensionNumber: string | null;
      extensionName: string | null;
      providerUsername: string | null;
      providerPassword: string | null;
      autoDetectExtension: boolean;
      updatedAt: string | null;
    };
  };
  intercomAgents: Array<{
    id: string;
    name: string;
    email: string;
    extensionNumber: string | null;
    extensionName: string | null;
  }>;
};

export type LandlordListResponse = {
  landlords: LandlordRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type LandlordLookupResponse = {
  phoneInput: string;
  phoneLast10: string;
  phoneE164: string;
  landlordExists: boolean;
  ownershipConflict: boolean;
  canCreateLandlord: boolean;
  canCreateProperty: boolean;
  lockUntil: string | null;
  leadId: string | null;
  landlord: (LandlordRow & { ownerAgentId: string; _count: { properties: number } }) | null;
};

export type RoomDraftInput = {
  roomName: string;
  rentPerMonth?: number | string | null;
  rentPerWeek?: number | string | null;
  landlordDemand?: number | string | null;
  expectedCommissionPct?: number | string | null;
};

export type PropertyDraftPayload = {
  landlordId?: string;
  propertyRef?: string;
  title?: string | null;
  description?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  propertyType?: string | null;
  propertyCategory?: "PRIVATE" | "SHARED";
  beds?: number | null;
  baths?: number | null;
  status?: PropertyStatus;
  vacancyType?: VacancyType;
  landlordDemand?: number | string | null;
  expectedCommissionPct?: number | string | null;
  expectedCommissionAmt?: number | string | null;
  totalRooms?: number | null;
  availableRooms?: number | null;
  rentPerMonth?: number | string | null;
  rentPerWeek?: number | string | null;
  depositAmount?: number | string | null;
  isFurnished?: boolean | null;
  personsAllowed?: number | null;
  petsAllowed?: boolean | null;
  dssAllowed?: boolean | null;
  childrenAllowed?: boolean | null;
  availabilityDate?: string | null;
  livingLandlord?: boolean | null;
  mediaAssetIds?: string[];
  mediaAssets?: PropertyMediaSelection[];
  rooms?: RoomDraftInput[];
};

export type CloseSaleTenantPayload = {
  fullName: string;
  email?: string;
  phone?: string;
  phoneNo?: string;
  currentAddress?: string;
  currentPostcode?: string;
  preferredPostcode?: string;
  moveInDate?: string;
  rentAmount?: number;
  depositAmount?: number;
  interestedIn?: string;
  budget?: string;
  notes?: string;
};

export type CloseSalePayload = {
  finalAmount: number;
  commissionPct: number;
  otherCosts?: number;
  tenant: CloseSaleTenantPayload;
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeLandlordCreatePayload(
  payload:
    | {
        firstName: string;
        lastName: string;
        phoneNo: string;
        email?: string;
        notes?: string;
        ownerAgentId?: string;
      }
    | {
        fullName: string;
        phone: string;
        email?: string;
        notes?: string;
        ownerAgentId?: string;
      },
) {
  if ("firstName" in payload) {
    return {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phoneNo: normalizePhoneNo(payload.phoneNo),
      email: payload.email?.trim() || undefined,
      notes: payload.notes?.trim() || undefined,
      ownerAgentId: payload.ownerAgentId,
    };
  }

  const name = splitFullName(payload.fullName);
  return {
    firstName: name.firstName,
    lastName: name.lastName,
    phoneNo: normalizePhoneNo(payload.phone),
    email: payload.email?.trim() || undefined,
    notes: payload.notes?.trim() || undefined,
    ownerAgentId: payload.ownerAgentId,
  };
}

function normalizeTenantCreatePayload(
  payload:
    | {
        fullName: string;
        phoneNo: string;
        email?: string | null;
        currentAddress?: string | null;
        currentPostcode?: string | null;
        preferredPostcode?: string | null;
        moveInDate?: string | null;
        rentAmount?: number | null;
        depositAmount?: number | null;
        interestedIn?: string | null;
        budget?: string | null;
        notes?: string | null;
      }
    | {
        fullName: string;
        phone: string;
        email?: string | null;
        currentAddress?: string | null;
        moveInDate?: string | null;
        rentAmount?: number | null;
        depositAmount?: number | null;
        notes?: string | null;
      },
) {
  if ("phoneNo" in payload) {
    return {
      fullName: payload.fullName.trim(),
      phoneNo: normalizePhoneNo(payload.phoneNo),
      email: payload.email?.trim() || null,
      currentAddress: payload.currentAddress?.trim() || null,
      currentPostcode: payload.currentPostcode ? normalizePostcode(payload.currentPostcode) : null,
      preferredPostcode: payload.preferredPostcode ? normalizePostcode(payload.preferredPostcode) : null,
      moveInDate: payload.moveInDate || null,
      rentAmount: payload.rentAmount ?? null,
      depositAmount: payload.depositAmount ?? null,
      interestedIn: payload.interestedIn?.trim() || null,
      budget: payload.budget?.trim() || null,
      notes: payload.notes?.trim() || null,
    };
  }

  return {
    fullName: payload.fullName.trim(),
    phoneNo: normalizePhoneNo(payload.phone),
    email: payload.email?.trim() || null,
    currentAddress: payload.currentAddress?.trim() || null,
    currentPostcode: null,
    preferredPostcode: null,
    moveInDate: payload.moveInDate || null,
    rentAmount: payload.rentAmount ?? null,
    depositAmount: payload.depositAmount ?? null,
    interestedIn: null,
    budget: null,
    notes: payload.notes?.trim() || null,
  };
}

function normalizePropertyDraftPayload(payload: PropertyDraftPayload) {
  return {
    ...payload,
    propertyRef: payload.propertyRef?.trim() || undefined,
    title: payload.title?.trim() || null,
    description: payload.description?.trim() || null,
    addressLine1: payload.addressLine1?.trim() || null,
    addressLine2: payload.addressLine2?.trim() || null,
    city: payload.city?.trim() || null,
    county: payload.county?.trim() || null,
    postcode: payload.postcode ? normalizePostcode(payload.postcode) : null,
    propertyType: payload.propertyType?.trim() || null,
    propertyCategory: payload.propertyCategory ?? undefined,
    landlordDemand: payload.landlordDemand ?? null,
    expectedCommissionPct: payload.expectedCommissionPct ?? null,
    expectedCommissionAmt: payload.expectedCommissionAmt ?? null,
    totalRooms: payload.totalRooms ?? null,
    availableRooms: payload.availableRooms ?? null,
    rentPerMonth: payload.rentPerMonth ?? null,
    rentPerWeek: payload.rentPerWeek ?? null,
    depositAmount: payload.depositAmount ?? null,
    availabilityDate: payload.availabilityDate ?? null,
    mediaAssets: payload.mediaAssets ?? [],
    rooms:
      payload.rooms?.map((room) => ({
        roomName: room.roomName.trim(),
        rentPerMonth: room.rentPerMonth ?? null,
        rentPerWeek: room.rentPerWeek ?? null,
        expectedCommissionPct: room.expectedCommissionPct ?? null,
      })) ?? [],
  };
}

export function fetchLandlords(params: {
  search?: string;
  agent?: string;
  phoneLast10?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  mine?: boolean;
}): Promise<ApiResult<LandlordListResponse>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.agent) query.set("agent", params.agent);
  if (params.phoneLast10) query.set("phoneLast10", params.phoneLast10);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.mine) query.set("mine", "true");

  return apiGet<LandlordListResponse>(`/api/landlords?${query.toString()}`);
}

// Fetch a small list of landlords for use in dropdowns (max 200, no pagination needed for selects)
export function fetchLandlordsForDropdown(): Promise<ApiResult<LandlordListResponse>> {
  return apiGet<LandlordListResponse>("/api/landlords?mine=true&pageSize=200");
}

export function checkLandlordNumber(
  phone: string,
): Promise<ApiResult<LandlordLookupResponse>> {
  return apiGet(`/api/landlords/check-number?phone=${encodeURIComponent(normalizePhoneNo(phone))}`);
}

export function createLandlord(
  payload:
    | {
        firstName: string;
        lastName: string;
        phoneNo: string;
        email?: string;
        notes?: string;
        ownerAgentId?: string;
      }
    | {
        fullName: string;
        phone: string;
        email?: string;
        notes?: string;
        ownerAgentId?: string;
      },
): Promise<ApiResult<{ landlord: LandlordRow }>> {
  return apiPost("/api/landlords", normalizeLandlordCreatePayload(payload));
}

export function fetchLandlordDetails(id: string): Promise<ApiResult<{ landlord: LandlordDetails }>> {
  return apiGet(`/api/landlords/${id}`);
}

export function updateLandlord(
  id: string,
  payload: Partial<{
    fullName: string;
    email: string | null;
    notes: string | null;
    isPassive: boolean;
    ownerAgentId: string;
    reassignmentReason: string;
  }>,
): Promise<ApiResult<{
  landlord: LandlordDetails;
  approvalRequired?: boolean;
  approvalRequest?: {
    id: string;
    status: string;
    entityType: string;
    entityId: string;
    summary: string | null;
    createdAt: string;
  };
  message?: string;
}>> {
  return apiPatch(`/api/landlords/${id}`, payload);
}

export function setLandlordPassive(
  id: string,
  isPassive: boolean,
): Promise<ApiResult<{ landlord: LandlordDetails }>> {
  return apiPatch(`/api/landlords/${id}`, { isPassive });
}

export function fetchLandlordProperties(
  landlordId: string,
): Promise<
  ApiResult<{
    landlord: {
      id: string;
      fullName: string;
      phoneE164: string | null;
      phoneLast10: string;
      email: string | null;
      ownerAgentId: string;
    };
    properties: PropertyRow[];
  }>
> {
  return apiGet(`/api/landlords/${landlordId}/properties`);
}

export function createLandlordProperty(
  landlordId: string,
  payload: PropertyDraftPayload,
): Promise<ApiResult<{ property: PropertyRow }>> {
  return apiPost(`/api/landlords/${landlordId}/properties`, normalizePropertyDraftPayload(payload));
}

export function createPropertyIntake(payload: {
  landlordId?: string;
  landlord?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phoneNo?: string;
    phone?: string;
    email?: string | null;
    notes?: string | null;
    ownerAgentId?: string;
  };
  property: PropertyDraftPayload;
}): Promise<
  ApiResult<{
    landlordCreated: boolean;
    landlord: {
      id: string;
      landlordName: string;
      ownerAgentId: string;
      phoneLast10: string;
    };
    property: PropertyRow;
    callRecord?: WorkflowCallRecordRow | null;
  }>
> {
  return apiPost("/api/properties/intake", {
    landlordId: payload.landlordId,
    landlord: payload.landlord
      ? payload.landlord.phoneNo || payload.landlord.phone
        ? {
            firstName:
              payload.landlord.firstName ??
              splitFullName(payload.landlord.fullName ?? "").firstName,
            lastName:
              payload.landlord.lastName ??
              splitFullName(payload.landlord.fullName ?? "").lastName,
            phoneNo: normalizePhoneNo(payload.landlord.phoneNo ?? payload.landlord.phone ?? ""),
            email: payload.landlord.email?.trim() || undefined,
            notes: payload.landlord.notes?.trim() || undefined,
            ownerAgentId: payload.landlord.ownerAgentId,
          }
        : undefined
      : undefined,
    property: normalizePropertyDraftPayload(payload.property),
  });
}

export function createPotentialLandlordLead(payload: {
  firstName: string;
  lastName: string;
  phoneNo: string;
  email?: string;
  followUpAt?: string | null;
  notes?: string | null;
  continuationLeadId?: string | null;
}): Promise<ApiResult<{ potentialLandlord: PotentialLandlordRow; callRecord?: WorkflowCallRecordRow | null }>> {
  return apiPost("/api/potential-landlords", {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    phoneNo: normalizePhoneNo(payload.phoneNo),
    email: payload.email?.trim() || undefined,
    followUpAt: payload.followUpAt ?? null,
    notes: payload.notes?.trim() || null,
    continuationLeadId: payload.continuationLeadId ?? null,
  });
}

export function createFollowUpLead(payload: {
  firstName: string;
  lastName: string;
  phoneNo: string;
  email?: string;
  followUpAt?: string | null;
  notes?: string | null;
  continuationLeadId?: string | null;
}): Promise<ApiResult<{ potentialLandlord: PotentialLandlordRow; callRecord?: WorkflowCallRecordRow | null }>> {
  return createPotentialLandlordLead(payload);
}

export function createPotentialTenant(payload: {
  fullName: string;
  email?: string | null;
  phoneNo: string;
  currentAddress?: string | null;
  currentPostcode?: string | null;
  preferredPostcode?: string | null;
  moveInDate?: string | null;
  rentAmount?: number | null;
  depositAmount?: number | null;
  interestedIn?: string | null;
  budget?: string | null;
  notes?: string | null;
}): Promise<ApiResult<{ potentialTenant: PotentialTenantRow }>> {
  return apiPost("/api/potential-tenants", {
    fullName: payload.fullName.trim(),
    email: payload.email?.trim() || null,
    phoneNo: normalizePhoneNo(payload.phoneNo),
    currentAddress: payload.currentAddress?.trim() || null,
    currentPostcode: payload.currentPostcode ? normalizePostcode(payload.currentPostcode) : null,
    preferredPostcode: payload.preferredPostcode ? normalizePostcode(payload.preferredPostcode) : null,
    moveInDate: payload.moveInDate || null,
    rentAmount: payload.rentAmount ?? null,
    depositAmount: payload.depositAmount ?? null,
    interestedIn: payload.interestedIn?.trim() || null,
    budget: payload.budget?.trim() || null,
    notes: payload.notes?.trim() || null,
  });
}

export function createWorkflowCallLog(payload: {
  phoneNo: string;
  outcome: WorkflowCallOutcome;
  landlordName?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  propertyRef?: string | null;
  followUpAt?: string | null;
  notes?: string | null;
  leadId?: string | null;
}): Promise<ApiResult<{ record: WorkflowCallRecordRow }>> {
  return apiPost("/api/call-records", {
    phoneNo: normalizePhoneNo(payload.phoneNo),
    outcome: payload.outcome,
    landlordName: payload.landlordName?.trim() || null,
    landlordId: payload.landlordId ?? null,
    propertyId: payload.propertyId ?? null,
    propertyRef: payload.propertyRef?.trim() || null,
    followUpAt: payload.followUpAt ?? null,
    notes: payload.notes?.trim() || null,
    leadId: payload.leadId ?? null,
  });
}

export function fetchPotentialLandlords(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<{ potentialLandlords: PotentialLandlordRow[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/potential-landlords${suffix}`);
}

export function fetchPotentialTenants(params?: {
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<{ potentialTenants: PotentialTenantRow[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/potential-tenants${suffix}`);
}

export function fetchWorkflowCallRecords(params?: {
  search?: string;
  outcome?: WorkflowCallOutcome;
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<{ records: WorkflowCallRecordRow[]; pagination?: { page: number; pageSize: number; total: number; totalPages: number } }>> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.outcome) query.set("outcome", params.outcome);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/call-records${suffix}`);
}

export function fetchDailyReports(): Promise<ApiResult<{ reports: DailyReportSummaryRow[] }>> {
  return apiGet("/api/daily-reports");
}

export function fetchAdminDailyReports(params?: {
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<ApiResult<{ reports: DailyReportSummaryRow[] }>> {
  const query = new URLSearchParams();
  if (params?.agentId) query.set("agentId", params.agentId);
  if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params?.dateTo) query.set("dateTo", params.dateTo);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/admin/daily-reports${suffix}`);
}

export function fetchProperties(params: {
  search?: string;
  phoneLast10?: string;
  propertyRef?: string;
  status?: PropertyStatus;
  city?: string;
  postcode?: string;
  createdAt?: string;
  page?: number;
  pageSize?: number;
}): Promise<
  ApiResult<{
    properties: Array<
      PropertyRow & {
        landlord: {
          id: string;
          landlordName: string;
          phoneE164: string | null;
          phoneLast10: string;
          ownerAgentId: string;
        };
      }
    >;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>
> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.phoneLast10) query.set("phoneLast10", params.phoneLast10);
  if (params.propertyRef) query.set("propertyRef", params.propertyRef);
  if (params.status) query.set("status", params.status);
  if (params.city) query.set("city", params.city);
  if (params.postcode) query.set("postcode", normalizePostcode(params.postcode));
  if (params.createdAt) query.set("createdAt", params.createdAt);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return apiGet(`/api/properties?${query.toString()}`);
}

export function updateProperty(
  propertyId: string,
  payload: Partial<PropertyDraftPayload>,
): Promise<ApiResult<{
  property: PropertyRow;
  approvalRequired?: boolean;
  approvalRequest?: {
    id: string;
    status: string;
    entityType: string;
    entityId: string;
    summary: string | null;
    createdAt: string;
  };
  message?: string;
}>> {
  return apiPatch(`/api/properties/${propertyId}`, payload);
}

export function togglePropertyWebsitePublish(
  propertyId: string,
  publishedToWebsite: boolean
): Promise<ApiResult<{ property: PropertyRow }>> {
  return apiPatch(`/api/properties/${propertyId}/publish`, { publishedToWebsite });
}

export function listMediaLibrary(): Promise<ApiResult<{ assets: MediaAssetRow[] }>> {
  return apiGet("/api/media-library");
}

export function uploadMediaAssets(payload: {
  files: Array<{
    name?: string;
    dataUrl: string;
  }>;
}): Promise<ApiResult<{ assets: MediaAssetRow[] }>> {
  return apiPost("/api/media-library", payload);
}

export function updateMediaAssetName(
  assetId: string,
  name: string,
): Promise<ApiResult<{ asset: MediaAssetRow }>> {
  return apiPatch(`/api/media-library/${assetId}`, { name });
}

export function deleteMediaAsset(assetId: string): Promise<ApiResult<{ ok: boolean }>> {
  return apiDelete(`/api/media-library/${assetId}`);
}

export function createTenant(
  payload:
    | {
        fullName: string;
        phoneNo: string;
        email?: string | null;
        currentAddress?: string | null;
        currentPostcode?: string | null;
        preferredPostcode?: string | null;
        moveInDate?: string | null;
        rentAmount?: number | null;
        depositAmount?: number | null;
        interestedIn?: string | null;
        budget?: string | null;
        notes?: string | null;
      }
    | {
        fullName: string;
        phone: string;
        email?: string | null;
        currentAddress?: string | null;
        moveInDate?: string | null;
        rentAmount?: number | null;
        depositAmount?: number | null;
        notes?: string | null;
      },
): Promise<ApiResult<{ tenant: TenantRow }>> {
  return apiPost("/api/tenants", normalizeTenantCreatePayload(payload));
}

// Phone is not editable — use createTenant phone for unique ID
export function updateTenant(
  tenantId: string,
  payload: {
    fullName?: string;
    email?: string | null;
    currentAddress?: string | null;
    moveInDate?: string | null;
    rentAmount?: number | null;
    depositAmount?: number | null;
    notes?: string | null;
  },
): Promise<ApiResult<{
  tenant: TenantRow;
  approvalRequired?: boolean;
  approvalRequest?: {
    id: string;
    status: string;
    entityType: string;
    entityId: string;
    summary: string | null;
    createdAt: string;
  };
  message?: string;
}>> {
  return apiPatch(`/api/tenants/${tenantId}`, payload);
}

export function addPropertyRoom(
  propertyId: string,
  payload: RoomDraftInput,
): Promise<ApiResult<{ room: PropertyRoomRow }>> {
  return apiPost(`/api/properties/${propertyId}/rooms`, payload);
}

export function updatePropertyRoom(
  propertyId: string,
  roomId: string,
  payload: Partial<RoomDraftInput>,
): Promise<
  ApiResult<{
    room?: PropertyRoomRow;
    approvalRequired?: boolean;
    approvalRequest?: {
      id: string;
      status: string;
      entityType: string;
      entityId: string;
      summary: string | null;
      createdAt: string;
    };
    message?: string;
  }>
> {
  return apiPatch(`/api/properties/${propertyId}/rooms/${roomId}`, payload);
}

export function deletePropertyRoom(
  propertyId: string,
  roomId: string,
): Promise<
  ApiResult<{
    deletedRoomId?: string;
    approvalRequired?: boolean;
    approvalRequest?: {
      id: string;
      status: string;
      entityType: string;
      entityId: string;
      summary: string | null;
      createdAt: string;
    };
    message?: string;
  }>
> {
  return apiDelete(`/api/properties/${propertyId}/rooms/${roomId}`);
}

export function closePropertySale(
  propertyId: string,
  payload: CloseSalePayload,
): Promise<ApiResult<{ sale: SaleRow; tenant: TenantRow }>> {
  return apiPost(`/api/properties/${propertyId}/close-sale`, payload);
}

export function closePropertyRoomSale(
  propertyId: string,
  roomId: string,
  payload: CloseSalePayload,
): Promise<ApiResult<{ sale: SaleRow; tenant: { id: string; fullName: string }; allRoomsClosed: boolean }>> {
  return apiPost(`/api/properties/${propertyId}/rooms/${roomId}/close`, payload);
}

export function listSales(params: {
  dateFrom?: string;
  dateTo?: string;
  agent?: string;
  status?: PropertyStatus;
  city?: string;
  postcode?: string;
  format?: "json" | "csv";
  page?: number;
  pageSize?: number;
}): Promise<
  ApiResult<{
    sales: Array<
      SaleRow & {
        property: {
          id: string;
          propertyRef: string;
          status: PropertyStatus;
          city: string | null;
          postcode: string | null;
          ownerAgentId: string;
          ownerAgent: {
            id: string;
            agentDisplayName: string;
            email: string;
          };
          landlord: {
            id: string;
            landlordName: string;
            phoneLast10: string;
          };
        };
      }
    >;
    totals: {
      finalAmount: number | null;
      commissionAmount: number | null;
      profit: number | null;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  }>
> {
  const query = new URLSearchParams();
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.agent) query.set("agent", params.agent);
  if (params.status) query.set("status", params.status);
  if (params.city) query.set("city", params.city);
  if (params.postcode) query.set("postcode", normalizePostcode(params.postcode));
  if (params.format) query.set("format", params.format);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return apiGet(`/api/sales?${query.toString()}`);
}

export function listAgents(params: {
  search?: string;
  includeDisabled?: boolean;
}): Promise<ApiResult<{ agents: AgentRow[] }>> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.includeDisabled !== undefined) {
    query.set("includeDisabled", String(params.includeDisabled));
  }
  return apiGet(`/api/admin/users?${query.toString()}`);
}

export function reassignAgentRecords(
  agentId: string,
  payload:
    | {
        mode: "BULK";
        targetAgentId: string;
        categories: AgentTransferCategory[];
        reason: string;
      }
    | {
        mode: "SINGLE";
        targetAgentId: string;
        entityType: AgentTransferEntityType;
        entityId: string;
        reason: string;
      },
): Promise<
  ApiResult<{
    message: string;
    summary: AgentTransferSummary;
    sourceAgent: {
      id: string;
      agentDisplayName: string;
      email: string;
    };
    targetAgent: {
      id: string;
      agentDisplayName: string;
      email: string;
    };
  }>
> {
  return apiPost(`/api/admin/users/${agentId}/reassign`, payload);
}

export function listAuditLogs(params: {
  entityType?: string;
  action?: string;
  user?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<AuditLogListResponse>> {
  const query = new URLSearchParams();
  if (params.entityType) query.set("entityType", params.entityType);
  if (params.action) query.set("action", params.action);
  if (params.user) query.set("user", params.user);
  if (params.dateFrom) query.set("dateFrom", params.dateFrom);
  if (params.dateTo) query.set("dateTo", params.dateTo);
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));

  return apiGet(`/api/admin/audit?${query.toString()}`);
}

export function listApprovals(params?: {
  status?: "PENDING" | "APPROVED" | "REJECTED";
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<ApprovalListResponse>> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.page) query.set("page", String(params.page));
  if (params?.pageSize) query.set("pageSize", String(params.pageSize));

  return apiGet(`/api/approvals?${query.toString()}`);
}

export function fetchDialerDomain(): Promise<ApiResult<{ config: DialerDomainConfigRow }>> {
  return apiGet("/api/admin/dialer-domain");
}

export function updateDialerDomain(payload: {
  dialerMode?: "SIP" | "LINKUS";
  linkusWebClientUrl?: string | null;
  pbxPlatform?: string | null;
  domain?: string | null;
  sipPort?: number | null;
  sipTransport?: string | null;
  websocketHost?: string | null;
  isEnabled?: boolean;
}): Promise<ApiResult<{ message: string; config: DialerDomainConfigRow }>> {
  return apiPatch("/api/admin/dialer-domain", payload);
}

export function fetchAdminAgentDialerSettings(
  agentId: string,
): Promise<ApiResult<{ agent: AdminAgentDialerSettings }>> {
  return apiGet(`/api/admin/users/${agentId}/settings`);
}

export function updateAdminAgentDialerSettings(
  agentId: string,
  payload: Partial<{
    email: string;
    agentDisplayName: string;
    isActive: boolean;
    newPassword: string;
    providerUsername: string | null;
    providerPassword: string | null;
    extensionNumber: string | null;
    extensionName: string | null;
    autoDetectExtension: boolean;
  }>,
): Promise<ApiResult<{ message: string; agent: AdminAgentDialerSettings }>> {
  return apiPatch(`/api/admin/users/${agentId}/settings`, payload);
}

export function fetchDialerBootstrap(): Promise<ApiResult<DialerBootstrapResponse>> {
  return apiGet("/api/dialer/bootstrap");
}

export function listDialerContacts(params?: {
  search?: string;
  labelId?: string;
}): Promise<ApiResult<{ contacts: DialerContactRow[] }>> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.labelId) query.set("labelId", params.labelId);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/dialer/contacts${suffix}`);
}

export function createDialerContact(payload: {
  fullName: string;
  phoneNumber: string;
  extensionNumber?: string | null;
  email?: string | null;
  notes?: string | null;
  isFavorite?: boolean;
  labelIds?: string[];
}): Promise<ApiResult<{ message: string; contact: DialerContactRow }>> {
  return apiPost("/api/dialer/contacts", payload);
}

export function updateDialerContact(
  contactId: string,
  payload: Partial<{
    fullName: string;
    phoneNumber: string;
    extensionNumber: string | null;
    email: string | null;
    notes: string | null;
    isFavorite: boolean;
    labelIds: string[];
  }>,
): Promise<ApiResult<{ message: string; contact: DialerContactRow }>> {
  return apiPatch(`/api/dialer/contacts/${contactId}`, payload);
}

export function deleteDialerContact(
  contactId: string,
): Promise<ApiResult<{ message: string }>> {
  return apiDelete(`/api/dialer/contacts/${contactId}`);
}

export function listDialerLabels(): Promise<ApiResult<{ labels: DialerLabelRow[] }>> {
  return apiGet("/api/dialer/labels");
}

export function createDialerLabel(payload: {
  name: string;
  colorHex?: string;
}): Promise<ApiResult<{ message: string; label: DialerLabelRow }>> {
  return apiPost("/api/dialer/labels", payload);
}

export function updateDialerLabel(
  labelId: string,
  payload: Partial<{ name: string; colorHex: string }>,
): Promise<ApiResult<{ message: string; label: DialerLabelRow }>> {
  return apiPatch(`/api/dialer/labels/${labelId}`, payload);
}

export function deleteDialerLabel(
  labelId: string,
): Promise<ApiResult<{ message: string }>> {
  return apiDelete(`/api/dialer/labels/${labelId}`);
}

export function listDialerHistory(params?: {
  direction?: DialerCallHistoryRow["direction"];
  status?: DialerCallHistoryRow["status"];
  search?: string;
  from?: string;
  to?: string;
  contactId?: string;
  limit?: number;
}): Promise<ApiResult<{ calls: DialerCallHistoryRow[] }>> {
  const query = new URLSearchParams();
  if (params?.direction) query.set("direction", params.direction);
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  if (params?.from) query.set("from", params.from);
  if (params?.to) query.set("to", params.to);
  if (params?.contactId) query.set("contactId", params.contactId);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet(`/api/dialer/history${suffix}`);
}

export function createDialerCallHistory(payload: {
  direction: DialerCallHistoryRow["direction"];
  status?: DialerCallHistoryRow["status"];
  contactId?: string;
  counterpartUserId?: string | null;
  peerName?: string | null;
  peerNumber?: string | null;
  peerExtension?: string | null;
  startedAt?: string;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSec?: number;
  recordingUrl?: string | null;
  notes?: string | null;
}): Promise<ApiResult<{ message: string; call: DialerCallHistoryRow }>> {
  return apiPost("/api/dialer/history", payload);
}

export function updateDialerCallHistory(
  callId: string,
  payload: Partial<{
    status: DialerCallHistoryRow["status"];
    answeredAt: string | null;
    endedAt: string | null;
    durationSec: number;
    recordingUrl: string | null;
    notes: string | null;
  }>,
): Promise<ApiResult<{ message: string; call: DialerCallHistoryRow }>> {
  return apiPatch(`/api/dialer/history/${callId}`, payload);
}

export function deleteDialerCallHistory(
  callId: string,
): Promise<ApiResult<{ message: string }>> {
  return apiDelete(`/api/dialer/history/${callId}`);
}
