CREATE TYPE "public"."dealer_type" AS ENUM('LANDLORD', 'AGENT');--> statement-breakpoint
ALTER TABLE "landlords" ADD COLUMN "dealer_type" "dealer_type" DEFAULT 'LANDLORD' NOT NULL;