ALTER TABLE "events" ADD COLUMN "has_seating" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "seat_row" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "seat_number" integer;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_seat_key" UNIQUE("seat_row","seat_number");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_seat_check" CHECK (("students"."seat_row" is null and "students"."seat_number" is null) or ("students"."seat_row" is not null and "students"."seat_number" is not null and "students"."seat_row" ~ '^[A-Z]$' and "students"."seat_number" between 1 and 99));