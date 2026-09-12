CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"period_anchor" date DEFAULT '2026-08-31' NOT NULL,
	"period_length_days" integer DEFAULT 14 NOT NULL,
	"hourly_rate" numeric(10, 2),
	"timezone" text DEFAULT 'America/Denver' NOT NULL,
	"day_start_hour" integer DEFAULT 6 NOT NULL,
	"day_end_hour" integer DEFAULT 22 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clock_in" timestamp with time zone NOT NULL,
	"clock_out" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_open_idx" ON "shifts" USING btree (("clock_out" IS NULL)) WHERE "shifts"."clock_out" IS NULL;