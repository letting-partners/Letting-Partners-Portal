ALTER TABLE "tenants" ADD COLUMN "room_type" varchar(80);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "occupants" varchar(40);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "monthly_income_pence" integer;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "occupation" varchar(160);--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "country_of_origin" varchar(120);