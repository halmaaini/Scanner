ALTER TABLE "events" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "map_url" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_check" CHECK ("events"."venue" is null or (btrim("events"."venue") <> '' and char_length("events"."venue") <= 200));--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_map_url_check" CHECK ("events"."map_url" is null or ("events"."map_url" ~ '^https?://[^[:space:]]+$' and char_length("events"."map_url") <= 500));--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_note_check" CHECK ("students"."note" is null or (btrim("students"."note") <> '' and char_length("students"."note") <= 300));