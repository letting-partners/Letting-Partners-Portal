CREATE TYPE "public"."blog_status" AS ENUM('DRAFT', 'PUBLISHED', 'TRASHED');--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(220) NOT NULL,
	"title" varchar(240) NOT NULL,
	"excerpt" text,
	"body" text NOT NULL,
	"banner_image_url" text,
	"banner_image_alt" varchar(300),
	"meta_title" varchar(240),
	"meta_description" varchar(400),
	"focus_keyword" varchar(160),
	"schema_json" text,
	"status" "blog_status" DEFAULT 'DRAFT' NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_live_key" ON "blog_posts" USING btree ("slug") WHERE "blog_posts"."status" <> 'TRASHED';--> statement-breakpoint
CREATE INDEX "blog_posts_status_idx" ON "blog_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");