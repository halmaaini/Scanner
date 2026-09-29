CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_open" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_id_check" CHECK ("events"."id" ~ '^[a-z0-9][a-z0-9_-]*$'),
	CONSTRAINT "events_name_check" CHECK (btrim("events"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"student_id" text NOT NULL,
	"event_id" text NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" integer,
	CONSTRAINT "registrations_student_id_event_id_pk" PRIMARY KEY("student_id","event_id"),
	CONSTRAINT "registrations_check_in_pair_check" CHECK (("registrations"."checked_in_at" is null) = ("registrations"."checked_in_by" is null))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_username_check" CHECK (btrim("staff"."username") <> ''),
	CONSTRAINT "staff_role_check" CHECK ("staff"."role" in ('admin', 'super'))
);
--> statement-breakpoint
CREATE TABLE "students" (
	"student_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_student_id_check" CHECK ("students"."student_id" ~ '^\S+$'),
	CONSTRAINT "students_full_name_check" CHECK (btrim("students"."full_name") <> '')
);
--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_student_id_students_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("student_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_checked_in_by_staff_id_fk" FOREIGN KEY ("checked_in_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registrations_event_id_idx" ON "registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sessions_expire_idx" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_username_lower_key" ON "staff" USING btree (lower("username"));