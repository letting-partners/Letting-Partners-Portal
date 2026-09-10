import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Every status/enumeration in the system lives here so that the database, the
 * services and the UI all agree on a single vocabulary. Never inline a status
 * string anywhere else in the codebase.
 */

/* ---------------------------------------------------------------- people */

export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "AGENT", "FRONTER"]);

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "INACTIVE", "SUSPENDED"]);

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE", "PREFER_NOT_TO_SAY", "OTHER"]);

export const themePreferenceEnum = pgEnum("theme_preference", ["LIGHT", "DARK", "SYSTEM"]);

/* --------------------------------------------------------------- sourcing */

export const contactSourceEnum = pgEnum("contact_source", [
  "CALL",
  "MANUAL",
  "REFERRAL",
  "WEBSITE",
  "IMPORT",
  "OTHER",
]);

/* ------------------------------------------------------------------ calls */

export const callStatusEnum = pgEnum("call_status", ["IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export const callOutcomeEnum = pgEnum("call_outcome", [
  "INTERESTED",
  "NOT_INTERESTED",
  "FOLLOW_UP",
  "NO_ANSWER",
  "CANCELLED",
]);

export const notInterestedReasonEnum = pgEnum("not_interested_reason", [
  "ALREADY_USING_AGENT",
  "NOT_CURRENTLY_RENTING",
  "NO_AGENCY_SERVICE",
  "PROPERTY_SOLD",
  "WRONG_NUMBER",
  "DO_NOT_CONTACT",
  "OTHER",
]);

/**
 * Only lifecycle states are persisted. "Upcoming", "Due Today" and "Overdue"
 * are derived from `dueAt` at read time so they can never go stale.
 */
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "SCHEDULED",
  "COMPLETED",
  "CONVERTED",
  "CANCELLED",
]);

export const priorityEnum = pgEnum("priority", ["LOW", "NORMAL", "HIGH"]);

/* ------------------------------------------------------------- properties */

export const propertyTypeEnum = pgEnum("property_type", ["FULL", "SHARED"]);

export const propertyCategoryEnum = pgEnum("property_category", ["HOUSE", "FLAT", "STUDIO_FLAT"]);

export const livingRoomEnum = pgEnum("living_room", ["SHARED", "PRIVATE", "NONE"]);

/** Website lifecycle. Kept deliberately separate from the deal pipeline. */
export const listingStatusEnum = pgEnum("listing_status", [
  "DRAFT",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "UNPUBLISHED",
  "LET_AGREED",
  "INACTIVE",
  "ARCHIVED",
]);

/** Deal pipeline. Kept deliberately separate from the website lifecycle. */
export const dealStageEnum = pgEnum("deal_stage", [
  "AVAILABLE",
  "VIEWING",
  "VERIFICATION",
  "CLOSING",
  "CLOSED_SUCCESSFUL",
  "CLOSED_UNSUCCESSFUL",
]);

export const roomStatusEnum = pgEnum("room_status", [
  "AVAILABLE",
  "VIEWING",
  "VERIFICATION",
  "CLOSING",
  "LET",
  "UNAVAILABLE",
]);

export const rentFrequencyEnum = pgEnum("rent_frequency", ["MONTHLY", "WEEKLY"]);

/* ---------------------------------------------------------------- tenants */

export const tenantStatusEnum = pgEnum("tenant_status", [
  "ACTIVE",
  "VIEWING",
  "NEGOTIATING",
  "PLACED",
  "INACTIVE",
]);

/* --------------------------------------------------------------- pipeline */

export const viewingStatusEnum = pgEnum("viewing_status", [
  "SCHEDULED",
  "COMPLETED_SUCCESSFUL",
  "COMPLETED_UNSUCCESSFUL",
  "CANCELLED",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "IN_PROGRESS",
  "SUCCESSFUL",
  "UNSUCCESSFUL",
  "CANCELLED",
]);

export const closingStatusEnum = pgEnum("closing_status", [
  "IN_PROGRESS",
  "CLOSED",
  "NOT_CLOSED",
  "CANCELLED",
]);

export const collaborationStatusEnum = pgEnum("collaboration_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "VIEWING",
  "VERIFICATION",
  "CLOSING",
  "CLOSED",
  "CANCELLED",
]);

/* ------------------------------------------------------------- commission */

export const commissionTypeEnum = pgEnum("commission_type", ["PERCENTAGE", "FIXED"]);

export const commissionScopeEnum = pgEnum("commission_scope", ["FRONTER", "AGENT"]);

export const commissionBeneficiaryEnum = pgEnum("commission_beneficiary", [
  "FRONTER",
  "PROPERTY_AGENT",
  "TENANT_AGENT",
  "COMPANY",
]);

/* ---------------------------------------------------------- notes / comms */

export const noteEntityEnum = pgEnum("note_entity", [
  "LANDLORD",
  "PROPERTY",
  "TENANT",
  "CALL",
  "FOLLOW_UP",
  "VIEWING",
  "DEAL",
  "COLLABORATION",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "NEW",
  "OPEN",
  "WAITING",
  "RESOLVED",
  "ARCHIVED",
]);

export const messageSenderEnum = pgEnum("message_sender", ["VISITOR", "STAFF", "SYSTEM"]);

export const internalConversationTypeEnum = pgEnum("internal_conversation_type", [
  "DIRECT",
  "GROUP",
  "TEAM",
]);

/** The lifecycle of a website article. */
export const blogStatusEnum = pgEnum("blog_status", ["DRAFT", "PUBLISHED", "TRASHED"]);

/**
 * Who brings a property to us. An outside agent is another company's letting
 * agent, not one of our own staff - our people are users, not dealers.
 */
export const dealerTypeEnum = pgEnum("dealer_type", ["LANDLORD", "AGENT"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "FOLLOW_UP_DUE",
  "CROSS_SELL_REQUEST",
  "CROSS_SELL_ACCEPTED",
  "CROSS_SELL_DECLINED",
  "VIEWING_SCHEDULED",
  "VIEWING_UPDATED",
  "VERIFICATION_UPDATED",
  "CLOSING_UPDATED",
  "SALE_COMPLETED",
  "COMMISSION_ADDED",
  "NEW_CUSTOMER_CHAT",
  "CUSTOMER_CHAT_MESSAGE",
  "INTERNAL_MESSAGE",
  "PROPERTY_PUBLISHED",
  "PROPERTY_NEEDS_PUBLIC_DETAILS",
  "USER_ASSIGNED",
  "FOLLOW_UP_OVERRIDDEN",
]);

/* ----------------------------------------------------------------- audit */

export const auditActionEnum = pgEnum("audit_action", [
  "CREATE",
  "UPDATE",
  "ARCHIVE",
  "RESTORE",
  "PUBLISH",
  "UNPUBLISH",
  "ASSIGN",
  "REASSIGN",
  "STAGE_CHANGE",
  "OVERRIDE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "PHONE_CORRECTION",
  "COMMISSION_CHANGE",
  "PERMISSION_CHANGE",
]);

export const activityTypeEnum = pgEnum("activity_type", [
  "LANDLORD_CREATED",
  "LANDLORD_UPDATED",
  "PROPERTY_CREATED",
  "PROPERTY_UPDATED",
  "PROPERTY_PUBLISHED",
  "PROPERTY_UNPUBLISHED",
  "ROOM_ADDED",
  "ROOM_UPDATED",
  "ROOM_LET",
  "CALL_LOGGED",
  "FOLLOW_UP_CREATED",
  "FOLLOW_UP_COMPLETED",
  "NOT_INTERESTED_LOGGED",
  "TENANT_CREATED",
  "VIEWING_SCHEDULED",
  "VIEWING_COMPLETED",
  "VERIFICATION_STARTED",
  "VERIFICATION_COMPLETED",
  "CLOSING_STARTED",
  "CLOSING_COMPLETED",
  "SALE_CREATED",
  "COLLABORATION_REQUESTED",
  "COLLABORATION_ANSWERED",
  "NOTE_ADDED",
  "OWNERSHIP_CHANGED",
  "STAGE_CHANGED",
]);
