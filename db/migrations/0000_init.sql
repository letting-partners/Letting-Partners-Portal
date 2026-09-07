CREATE TYPE "public"."activity_type" AS ENUM('LANDLORD_CREATED', 'LANDLORD_UPDATED', 'PROPERTY_CREATED', 'PROPERTY_UPDATED', 'PROPERTY_PUBLISHED', 'PROPERTY_UNPUBLISHED', 'ROOM_ADDED', 'ROOM_UPDATED', 'ROOM_LET', 'CALL_LOGGED', 'FOLLOW_UP_CREATED', 'FOLLOW_UP_COMPLETED', 'NOT_INTERESTED_LOGGED', 'TENANT_CREATED', 'VIEWING_SCHEDULED', 'VIEWING_COMPLETED', 'VERIFICATION_STARTED', 'VERIFICATION_COMPLETED', 'CLOSING_STARTED', 'CLOSING_COMPLETED', 'SALE_CREATED', 'COLLABORATION_REQUESTED', 'COLLABORATION_ANSWERED', 'NOTE_ADDED', 'OWNERSHIP_CHANGED', 'STAGE_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'ARCHIVE', 'RESTORE', 'PUBLISH', 'UNPUBLISH', 'ASSIGN', 'REASSIGN', 'STAGE_CHANGE', 'OVERRIDE', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'PHONE_CORRECTION', 'COMMISSION_CHANGE', 'PERMISSION_CHANGE');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('INTERESTED', 'NOT_INTERESTED', 'FOLLOW_UP', 'NO_ANSWER', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."closing_status" AS ENUM('IN_PROGRESS', 'CLOSED', 'NOT_CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."collaboration_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'VIEWING', 'VERIFICATION', 'CLOSING', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."commission_beneficiary" AS ENUM('FRONTER', 'PROPERTY_AGENT', 'TENANT_AGENT', 'COMPANY');--> statement-breakpoint
CREATE TYPE "public"."commission_scope" AS ENUM('FRONTER', 'AGENT');--> statement-breakpoint
CREATE TYPE "public"."commission_type" AS ENUM('PERCENTAGE', 'FIXED');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('CALL', 'MANUAL', 'REFERRAL', 'WEBSITE', 'IMPORT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('NEW', 'OPEN', 'WAITING', 'RESOLVED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('AVAILABLE', 'VIEWING', 'VERIFICATION', 'CLOSING', 'CLOSED_SUCCESSFUL', 'CLOSED_UNSUCCESSFUL');--> statement-breakpoint
CREATE TYPE "public"."follow_up_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CONVERTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."internal_conversation_type" AS ENUM('DIRECT', 'GROUP', 'TEAM');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('DRAFT', 'READY_TO_PUBLISH', 'PUBLISHED', 'UNPUBLISHED', 'LET_AGREED', 'INACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."living_room" AS ENUM('SHARED', 'PRIVATE', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('VISITOR', 'STAFF', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."not_interested_reason" AS ENUM('ALREADY_USING_AGENT', 'NOT_CURRENTLY_RENTING', 'NO_AGENCY_SERVICE', 'PROPERTY_SOLD', 'WRONG_NUMBER', 'DO_NOT_CONTACT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."note_entity" AS ENUM('LANDLORD', 'PROPERTY', 'TENANT', 'CALL', 'FOLLOW_UP', 'VIEWING', 'DEAL', 'COLLABORATION');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('FOLLOW_UP_DUE', 'CROSS_SELL_REQUEST', 'CROSS_SELL_ACCEPTED', 'CROSS_SELL_DECLINED', 'VIEWING_SCHEDULED', 'VIEWING_UPDATED', 'VERIFICATION_UPDATED', 'CLOSING_UPDATED', 'SALE_COMPLETED', 'COMMISSION_ADDED', 'NEW_CUSTOMER_CHAT', 'CUSTOMER_CHAT_MESSAGE', 'INTERNAL_MESSAGE', 'PROPERTY_PUBLISHED', 'PROPERTY_NEEDS_PUBLIC_DETAILS', 'USER_ASSIGNED', 'FOLLOW_UP_OVERRIDDEN');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'NORMAL', 'HIGH');--> statement-breakpoint
CREATE TYPE "public"."property_category" AS ENUM('HOUSE', 'FLAT', 'STUDIO_FLAT');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('FULL', 'SHARED');--> statement-breakpoint
CREATE TYPE "public"."rent_frequency" AS ENUM('MONTHLY', 'WEEKLY');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('AVAILABLE', 'VIEWING', 'VERIFICATION', 'CLOSING', 'LET', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('ACTIVE', 'VIEWING', 'NEGOTIATING', 'PLACED', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('LIGHT', 'DARK', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SUPER_ADMIN', 'AGENT', 'FRONTER');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('IN_PROGRESS', 'SUCCESSFUL', 'UNSUCCESSFUL', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."viewing_status" AS ENUM('SCHEDULED', 'COMPLETED_SUCCESSFUL', 'COMPLETED_UNSUCCESSFUL', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "agent_fronter_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fronter_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"code_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"request_ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip" varchar(64),
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"value" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"full_name" varchar(160) NOT NULL,
	"phone" varchar(32),
	"normalized_phone" varchar(16),
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"job_title" varchar(120),
	"avatar_url" text,
	"assigned_agent_id" uuid,
	"theme_preference" "theme_preference" DEFAULT 'SYSTEM' NOT NULL,
	"notification_preferences" jsonb DEFAULT '{"emailFollowUpReminders":true,"emailMissedCustomerChat":true,"inAppSound":true}'::jsonb NOT NULL,
	"public_phone" varchar(32),
	"public_email" varchar(254),
	"public_bio" text,
	"last_login_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "landlord_ownership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"landlord_id" uuid NOT NULL,
	"from_fronter_id" uuid,
	"to_fronter_id" uuid,
	"from_agent_id" uuid,
	"to_agent_id" uuid,
	"from_normalized_phone" varchar(16),
	"to_normalized_phone" varchar(16),
	"reason" text,
	"changed_by" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landlords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(254),
	"original_phone" varchar(32) NOT NULL,
	"normalized_phone" varchar(16) NOT NULL,
	"alternate_phone" varchar(32),
	"gender" "gender" DEFAULT 'PREFER_NOT_TO_SAY' NOT NULL,
	"source" "contact_source" DEFAULT 'CALL' NOT NULL,
	"originating_fronter_id" uuid,
	"assigned_agent_id" uuid,
	"created_by" uuid NOT NULL,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_phone" varchar(32) NOT NULL,
	"normalized_phone" varchar(16) NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"landlord_id" uuid,
	"called_by_id" uuid NOT NULL,
	"agent_id" uuid,
	"status" "call_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"outcome" "call_outcome",
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"duration_seconds" integer,
	"follow_up_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid,
	"landlord_id" uuid,
	"original_phone" varchar(32) NOT NULL,
	"normalized_phone" varchar(16) NOT NULL,
	"contact_name" varchar(160),
	"due_at" timestamp with time zone NOT NULL,
	"priority" "priority" DEFAULT 'NORMAL' NOT NULL,
	"reason" varchar(200),
	"notes" text NOT NULL,
	"status" "follow_up_status" DEFAULT 'SCHEDULED' NOT NULL,
	"created_by_id" uuid NOT NULL,
	"agent_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid,
	"converted_landlord_id" uuid,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "not_interested_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid,
	"original_phone" varchar(32) NOT NULL,
	"normalized_phone" varchar(16) NOT NULL,
	"contact_name" varchar(160),
	"reason" "not_interested_reason" NOT NULL,
	"notes" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_by_id" uuid NOT NULL,
	"agent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "image_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(260) NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"content_type" varchar(100),
	"size_bytes" integer,
	"width" integer,
	"height" integer,
	"checksum" varchar(128),
	"alt_text" text,
	"uploaded_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(24) NOT NULL,
	"landlord_id" uuid NOT NULL,
	"property_type" "property_type" NOT NULL,
	"category" "property_category",
	"address_line1" varchar(200) NOT NULL,
	"address_line2" varchar(200),
	"town" varchar(120),
	"county" varchar(120),
	"postcode" varchar(10) NOT NULL,
	"outcode" varchar(5) NOT NULL,
	"formatted_address" text NOT NULL,
	"area" varchar(120),
	"furnished" boolean,
	"living_landlord" boolean,
	"garden" boolean,
	"parking" boolean,
	"bills_included" boolean,
	"balcony" boolean,
	"disabled_access" boolean,
	"wifi" boolean,
	"couples_allowed" boolean,
	"pets_allowed" boolean,
	"dss_allowed" boolean,
	"children_allowed" boolean,
	"living_room" "living_room",
	"number_of_rooms" integer,
	"available_rooms" integer,
	"bathrooms" integer,
	"availability_date" date,
	"rent_per_month_pence" integer,
	"rent_per_week_pence" integer,
	"deposit_pence" integer,
	"commission_type" "commission_type",
	"commission_value" integer,
	"commission_amount_pence" integer,
	"title" varchar(200),
	"description" text,
	"slug" varchar(220),
	"meta_title" varchar(200),
	"meta_description" varchar(320),
	"listing_status" "listing_status" DEFAULT 'DRAFT' NOT NULL,
	"deal_stage" "deal_stage" DEFAULT 'AVAILABLE' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_id" uuid,
	"unpublished_at" timestamp with time zone,
	"originating_fronter_id" uuid,
	"assigned_agent_id" uuid,
	"created_by" uuid NOT NULL,
	"source" "contact_source" DEFAULT 'CALL' NOT NULL,
	"originating_call_id" uuid,
	"draft_state" jsonb,
	"draft_saved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	CONSTRAINT "properties_available_rooms_within_total" CHECK ("properties"."available_rooms" is null or "properties"."number_of_rooms" is null or "properties"."available_rooms" <= "properties"."number_of_rooms"),
	CONSTRAINT "properties_rent_positive" CHECK ("properties"."rent_per_month_pence" is null or "properties"."rent_per_month_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "property_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"field" varchar(80) NOT NULL,
	"previous_value" text,
	"new_value" text,
	"note" text,
	"changed_by_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"room_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"action" varchar(20) NOT NULL,
	"slug" varchar(220),
	"snapshot" jsonb,
	"performed_by_id" uuid NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "property_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"availability_date" date,
	"rent_frequency" "rent_frequency" DEFAULT 'MONTHLY' NOT NULL,
	"rent_per_month_pence" integer NOT NULL,
	"rent_per_week_pence" integer NOT NULL,
	"deposit_pence" integer,
	"commission_type" "commission_type",
	"commission_value" integer,
	"commission_amount_pence" integer,
	"status" "room_status" DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "property_rooms_rent_positive" CHECK ("property_rooms"."rent_per_month_pence" > 0)
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(254),
	"original_phone" varchar(32) NOT NULL,
	"normalized_phone" varchar(16) NOT NULL,
	"area" varchar(160),
	"postcode_preferences" varchar(200),
	"requirements" text,
	"min_budget_pence" integer,
	"max_budget_pence" integer,
	"move_in_date" date,
	"property_type_preference" "property_category",
	"bedrooms" integer,
	"status" "tenant_status" DEFAULT 'ACTIVE' NOT NULL,
	"source" "contact_source" DEFAULT 'MANUAL' NOT NULL,
	"owner_agent_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid
);
--> statement-breakpoint
CREATE TABLE "closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "closing_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"reason" text,
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_by_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "deal_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"from_stage" "deal_stage",
	"to_stage" "deal_stage" NOT NULL,
	"reason" text,
	"notes" text,
	"changed_by_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"tenant_id" uuid NOT NULL,
	"landlord_id" uuid NOT NULL,
	"stage" "deal_stage" DEFAULT 'VIEWING' NOT NULL,
	"property_agent_id" uuid NOT NULL,
	"tenant_agent_id" uuid,
	"originating_fronter_id" uuid,
	"collaboration_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"close_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"status" "verification_status" DEFAULT 'IN_PROGRESS' NOT NULL,
	"reason" text,
	"notes" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_by_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"tenant_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "viewing_status" DEFAULT 'SCHEDULED' NOT NULL,
	"outcome_reason" text,
	"notes" text,
	"completed_at" timestamp with time zone,
	"completed_by_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"beneficiary" "commission_beneficiary" NOT NULL,
	"beneficiary_user_id" uuid,
	"amount_pence" integer NOT NULL,
	"basis_pence" integer NOT NULL,
	"rule_type" "commission_type",
	"rule_value" integer,
	"pkr_rate_at_close" integer,
	"pkr_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(24) NOT NULL,
	"deal_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"landlord_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_agent_id" uuid NOT NULL,
	"tenant_agent_id" uuid,
	"originating_fronter_id" uuid,
	"collaboration_id" uuid,
	"gross_commission_pence" integer NOT NULL,
	"fronter_commission_pence" integer DEFAULT 0 NOT NULL,
	"agent_pool_pence" integer DEFAULT 0 NOT NULL,
	"property_agent_commission_pence" integer DEFAULT 0 NOT NULL,
	"tenant_agent_commission_pence" integer DEFAULT 0 NOT NULL,
	"company_net_pence" integer DEFAULT 0 NOT NULL,
	"pkr_rate_at_close" integer,
	"calculation_snapshot" jsonb NOT NULL,
	"closing_date" timestamp with time zone DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'COMPLETED' NOT NULL,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collaboration_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"tenant_id" uuid NOT NULL,
	"tenant_agent_id" uuid NOT NULL,
	"property_agent_id" uuid NOT NULL,
	"status" "collaboration_status" DEFAULT 'PENDING' NOT NULL,
	"message" text,
	"decline_reason" text,
	"property_agent_split_bp" integer,
	"tenant_agent_split_bp" integer,
	"deal_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_conversation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"performed_by_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_token" varchar(64) NOT NULL,
	"visitor_name" varchar(160),
	"visitor_email" varchar(254),
	"visitor_phone" varchar(32),
	"property_id" uuid,
	"assigned_agent_id" uuid,
	"status" "conversation_status" DEFAULT 'NEW' NOT NULL,
	"subject" varchar(200),
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_visitor_seen_at" timestamp with time zone,
	"last_staff_seen_at" timestamp with time zone,
	"visitor_typing_at" timestamp with time zone,
	"staff_typing_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" "message_sender" NOT NULL,
	"sender_user_id" uuid,
	"body" text NOT NULL,
	"is_internal_note" boolean DEFAULT false NOT NULL,
	"attachment_url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"typing_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "internal_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "internal_conversation_type" DEFAULT 'DIRECT' NOT NULL,
	"title" varchar(160),
	"direct_key" varchar(200),
	"created_by" uuid NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "internal_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"reply_to_id" uuid,
	"attachment_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "note_entity" NOT NULL,
	"entity_id" uuid NOT NULL,
	"body" text NOT NULL,
	"author_id" uuid NOT NULL,
	"edit_history" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"href" varchar(300),
	"entity_type" varchar(40),
	"entity_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "commission_scope" NOT NULL,
	"commission_type" "commission_type" NOT NULL,
	"value" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "cross_sell_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_agent_bp" integer NOT NULL,
	"tenant_agent_bp" integer NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"singleton" varchar(1) DEFAULT 'X' NOT NULL,
	CONSTRAINT "cross_sell_splits_total_100" CHECK ("cross_sell_splits"."property_agent_bp" + "cross_sell_splits"."tenant_agent_bp" = 10000)
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" varchar(3) DEFAULT 'GBP' NOT NULL,
	"quote_currency" varchar(3) DEFAULT 'PKR' NOT NULL,
	"rate_x100" integer NOT NULL,
	"source" varchar(40) DEFAULT 'MANUAL' NOT NULL,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_by_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "activity_type" NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid NOT NULL,
	"related_entity_type" varchar(60),
	"related_entity_id" uuid,
	"actor_id" uuid,
	"summary" varchar(300) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"user_label" varchar(200),
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(60) NOT NULL,
	"entity_id" uuid,
	"entity_label" varchar(200),
	"before" jsonb,
	"after" jsonb,
	"metadata" jsonb,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_fronter_assignments" ADD CONSTRAINT "agent_fronter_assignments_fronter_id_users_id_fk" FOREIGN KEY ("fronter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_fronter_assignments" ADD CONSTRAINT "agent_fronter_assignments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_fronter_assignments" ADD CONSTRAINT "agent_fronter_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_commission_rules" ADD CONSTRAINT "user_commission_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_commission_rules" ADD CONSTRAINT "user_commission_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_from_fronter_id_users_id_fk" FOREIGN KEY ("from_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_to_fronter_id_users_id_fk" FOREIGN KEY ("to_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_from_agent_id_users_id_fk" FOREIGN KEY ("from_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_to_agent_id_users_id_fk" FOREIGN KEY ("to_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlord_ownership_history" ADD CONSTRAINT "landlord_ownership_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlords" ADD CONSTRAINT "landlords_originating_fronter_id_users_id_fk" FOREIGN KEY ("originating_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlords" ADD CONSTRAINT "landlords_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlords" ADD CONSTRAINT "landlords_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landlords" ADD CONSTRAINT "landlords_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_called_by_id_users_id_fk" FOREIGN KEY ("called_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_converted_landlord_id_landlords_id_fk" FOREIGN KEY ("converted_landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "not_interested_records" ADD CONSTRAINT "not_interested_records_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "not_interested_records" ADD CONSTRAINT "not_interested_records_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "not_interested_records" ADD CONSTRAINT "not_interested_records_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_published_by_id_users_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_originating_fronter_id_users_id_fk" FOREIGN KEY ("originating_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_history" ADD CONSTRAINT "property_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_history" ADD CONSTRAINT "property_history_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_history" ADD CONSTRAINT "property_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_asset_id_image_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."image_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_images" ADD CONSTRAINT "property_images_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_publications" ADD CONSTRAINT "property_publications_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rooms" ADD CONSTRAINT "property_rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_owner_agent_id_users_id_fk" FOREIGN KEY ("owner_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closings" ADD CONSTRAINT "closings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closings" ADD CONSTRAINT "closings_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closings" ADD CONSTRAINT "closings_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_stage_history" ADD CONSTRAINT "deal_stage_history_changed_by_id_users_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_property_agent_id_users_id_fk" FOREIGN KEY ("property_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_agent_id_users_id_fk" FOREIGN KEY ("tenant_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_originating_fronter_id_users_id_fk" FOREIGN KEY ("originating_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_started_by_id_users_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_completed_by_id_users_id_fk" FOREIGN KEY ("completed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_beneficiary_user_id_users_id_fk" FOREIGN KEY ("beneficiary_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_landlord_id_landlords_id_fk" FOREIGN KEY ("landlord_id") REFERENCES "public"."landlords"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_property_agent_id_users_id_fk" FOREIGN KEY ("property_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_agent_id_users_id_fk" FOREIGN KEY ("tenant_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_originating_fronter_id_users_id_fk" FOREIGN KEY ("originating_fronter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_participants" ADD CONSTRAINT "collaboration_participants_collaboration_id_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."collaborations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_participants" ADD CONSTRAINT "collaboration_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_room_id_property_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."property_rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_tenant_agent_id_users_id_fk" FOREIGN KEY ("tenant_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_property_agent_id_users_id_fk" FOREIGN KEY ("property_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborations" ADD CONSTRAINT "collaborations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversation_events" ADD CONSTRAINT "customer_conversation_events_conversation_id_customer_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."customer_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversation_events" ADD CONSTRAINT "customer_conversation_events_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversation_events" ADD CONSTRAINT "customer_conversation_events_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversation_events" ADD CONSTRAINT "customer_conversation_events_performed_by_id_users_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversations" ADD CONSTRAINT "customer_conversations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_conversations" ADD CONSTRAINT "customer_conversations_assigned_agent_id_users_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_conversation_id_customer_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."customer_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_conversation_participants" ADD CONSTRAINT "internal_conversation_participants_conversation_id_internal_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."internal_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_conversation_participants" ADD CONSTRAINT "internal_conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_conversations" ADD CONSTRAINT "internal_conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_conversation_id_internal_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."internal_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_messages" ADD CONSTRAINT "internal_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_rules" ADD CONSTRAINT "commission_rules_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_sell_splits" ADD CONSTRAINT "cross_sell_splits_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "afa_fronter_idx" ON "agent_fronter_assignments" USING btree ("fronter_id");--> statement-breakpoint
CREATE INDEX "afa_agent_idx" ON "agent_fronter_assignments" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "afa_active_unique" ON "agent_fronter_assignments" USING btree ("fronter_id") WHERE "agent_fronter_assignments"."unassigned_at" is null;--> statement-breakpoint
CREATE INDEX "otp_email_idx" ON "otp_codes" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "otp_expires_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "rate_limits" USING btree ("window_started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "ucr_user_idx" ON "user_commission_rules" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ucr_active_unique" ON "user_commission_rules" USING btree ("user_id") WHERE "user_commission_rules"."effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_assigned_agent_idx" ON "users" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "loh_landlord_idx" ON "landlord_ownership_history" USING btree ("landlord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "landlords_normalized_phone_unique" ON "landlords" USING btree ("normalized_phone") WHERE "landlords"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "landlords_normalized_phone_idx" ON "landlords" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "landlords_fronter_idx" ON "landlords" USING btree ("originating_fronter_id");--> statement-breakpoint
CREATE INDEX "landlords_agent_idx" ON "landlords" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "landlords_created_at_idx" ON "landlords" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calls_normalized_phone_idx" ON "calls" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "calls_called_by_idx" ON "calls" USING btree ("called_by_id");--> statement-breakpoint
CREATE INDEX "calls_agent_idx" ON "calls" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "calls_started_at_idx" ON "calls" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "calls_outcome_idx" ON "calls" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "calls_landlord_idx" ON "calls" USING btree ("landlord_id");--> statement-breakpoint
CREATE UNIQUE INDEX "follow_ups_active_phone_unique" ON "follow_ups" USING btree ("normalized_phone") WHERE "follow_ups"."status" = 'SCHEDULED';--> statement-breakpoint
CREATE INDEX "follow_ups_normalized_phone_idx" ON "follow_ups" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "follow_ups_due_at_idx" ON "follow_ups" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "follow_ups_created_by_idx" ON "follow_ups" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "follow_ups_agent_idx" ON "follow_ups" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "follow_ups_status_idx" ON "follow_ups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "nir_normalized_phone_idx" ON "not_interested_records" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "nir_created_by_idx" ON "not_interested_records" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "nir_created_at_idx" ON "not_interested_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "image_assets_uploaded_by_idx" ON "image_assets" USING btree ("uploaded_by_id");--> statement-breakpoint
CREATE INDEX "image_assets_created_at_idx" ON "image_assets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "image_assets_checksum_unique" ON "image_assets" USING btree ("checksum") WHERE "image_assets"."checksum" is not null and "image_assets"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "properties_reference_unique" ON "properties" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_slug_unique" ON "properties" USING btree ("slug") WHERE "properties"."slug" is not null;--> statement-breakpoint
CREATE INDEX "properties_landlord_idx" ON "properties" USING btree ("landlord_id");--> statement-breakpoint
CREATE INDEX "properties_postcode_idx" ON "properties" USING btree ("postcode");--> statement-breakpoint
CREATE INDEX "properties_outcode_idx" ON "properties" USING btree ("outcode");--> statement-breakpoint
CREATE INDEX "properties_agent_idx" ON "properties" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "properties_fronter_idx" ON "properties" USING btree ("originating_fronter_id");--> statement-breakpoint
CREATE INDEX "properties_listing_status_idx" ON "properties" USING btree ("listing_status");--> statement-breakpoint
CREATE INDEX "properties_deal_stage_idx" ON "properties" USING btree ("deal_stage");--> statement-breakpoint
CREATE INDEX "properties_created_at_idx" ON "properties" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "property_history_property_idx" ON "property_history" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_images_unique" ON "property_images" USING btree ("property_id","asset_id");--> statement-breakpoint
CREATE INDEX "property_images_property_idx" ON "property_images" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "property_images_single_cover" ON "property_images" USING btree ("property_id") WHERE "property_images"."is_cover" = true;--> statement-breakpoint
CREATE INDEX "property_publications_property_idx" ON "property_publications" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_rooms_property_idx" ON "property_rooms" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_rooms_status_idx" ON "property_rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_owner_agent_idx" ON "tenants" USING btree ("owner_agent_id");--> statement-breakpoint
CREATE INDEX "tenants_normalized_phone_idx" ON "tenants" USING btree ("normalized_phone");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "closings_deal_idx" ON "closings" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "closings_status_idx" ON "closings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dsh_deal_idx" ON "deal_stage_history" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "dsh_changed_at_idx" ON "deal_stage_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "deals_property_idx" ON "deals" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "deals_room_idx" ON "deals" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_idx" ON "deals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_property_agent_idx" ON "deals" USING btree ("property_agent_id");--> statement-breakpoint
CREATE INDEX "deals_tenant_agent_idx" ON "deals" USING btree ("tenant_agent_id");--> statement-breakpoint
CREATE INDEX "deals_fronter_idx" ON "deals" USING btree ("originating_fronter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_success_per_room" ON "deals" USING btree ("room_id") WHERE "deals"."room_id" is not null and "deals"."stage" = 'CLOSED_SUCCESSFUL';--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_success_per_property" ON "deals" USING btree ("property_id") WHERE "deals"."room_id" is null and "deals"."stage" = 'CLOSED_SUCCESSFUL';--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_active_per_room" ON "deals" USING btree ("room_id") WHERE "deals"."room_id" is not null and "deals"."stage" in ('VIEWING','VERIFICATION','CLOSING');--> statement-breakpoint
CREATE UNIQUE INDEX "deals_one_active_per_property" ON "deals" USING btree ("property_id") WHERE "deals"."room_id" is null and "deals"."stage" in ('VIEWING','VERIFICATION','CLOSING');--> statement-breakpoint
CREATE INDEX "verifications_deal_idx" ON "verifications" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "verifications_status_idx" ON "verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "viewings_deal_idx" ON "viewings" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "viewings_property_idx" ON "viewings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "viewings_tenant_idx" ON "viewings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "viewings_agent_idx" ON "viewings" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "viewings_status_idx" ON "viewings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "viewings_scheduled_idx" ON "viewings" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "commissions_sale_idx" ON "commissions" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "commissions_user_idx" ON "commissions" USING btree ("beneficiary_user_id");--> statement-breakpoint
CREATE INDEX "commissions_beneficiary_idx" ON "commissions" USING btree ("beneficiary");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_reference_unique" ON "sales" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_deal_unique" ON "sales" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "sales_property_idx" ON "sales" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "sales_property_agent_idx" ON "sales" USING btree ("property_agent_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_agent_idx" ON "sales" USING btree ("tenant_agent_id");--> statement-breakpoint
CREATE INDEX "sales_fronter_idx" ON "sales" USING btree ("originating_fronter_id");--> statement-breakpoint
CREATE INDEX "sales_closing_date_idx" ON "sales" USING btree ("closing_date");--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_participants_unique" ON "collaboration_participants" USING btree ("collaboration_id","user_id");--> statement-breakpoint
CREATE INDEX "collaborations_property_idx" ON "collaborations" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "collaborations_tenant_agent_idx" ON "collaborations" USING btree ("tenant_agent_id");--> statement-breakpoint
CREATE INDEX "collaborations_property_agent_idx" ON "collaborations" USING btree ("property_agent_id");--> statement-breakpoint
CREATE INDEX "collaborations_status_idx" ON "collaborations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborations_open_request_unique" ON "collaborations" USING btree ("property_id","tenant_id") WHERE "collaborations"."status" in ('PENDING','ACCEPTED','VIEWING','VERIFICATION','CLOSING');--> statement-breakpoint
CREATE INDEX "cce_conversation_idx" ON "customer_conversation_events" USING btree ("conversation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_conversations_token_unique" ON "customer_conversations" USING btree ("visitor_token");--> statement-breakpoint
CREATE INDEX "customer_conversations_property_idx" ON "customer_conversations" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "customer_conversations_agent_idx" ON "customer_conversations" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX "customer_conversations_status_idx" ON "customer_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_conversations_last_message_idx" ON "customer_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "customer_messages_conversation_idx" ON "customer_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "icp_unique" ON "internal_conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "icp_user_idx" ON "internal_conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "internal_conversations_direct_key_unique" ON "internal_conversations" USING btree ("direct_key");--> statement-breakpoint
CREATE INDEX "internal_conversations_last_message_idx" ON "internal_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "internal_messages_conversation_idx" ON "internal_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_entity_idx" ON "notes" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "notes_author_idx" ON "notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "notes_created_at_idx" ON "notes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "commission_rules_scope_idx" ON "commission_rules" USING btree ("scope");--> statement-breakpoint
CREATE UNIQUE INDEX "commission_rules_active_unique" ON "commission_rules" USING btree ("scope") WHERE "commission_rules"."effective_to" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "cross_sell_splits_active_unique" ON "cross_sell_splits" USING btree ("singleton") WHERE "cross_sell_splits"."effective_to" is null;--> statement-breakpoint
CREATE INDEX "exchange_rates_created_at_idx" ON "exchange_rates" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activities_entity_idx" ON "activities" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activities_actor_idx" ON "activities" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "activities_created_at_idx" ON "activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");