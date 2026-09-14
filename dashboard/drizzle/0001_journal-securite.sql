CREATE TABLE "security_events" (
	"id" text PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL,
	"details" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "security_events_at_idx" ON "security_events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "security_events_type_idx" ON "security_events" USING btree ("type");