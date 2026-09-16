CREATE TYPE "public"."attachment_content_type" AS ENUM('application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/heif', 'image/tiff', 'image/bmp');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('untreated', 'treated');--> statement-breakpoint
CREATE TYPE "public"."message_subject" AS ENUM('missing_or_damaged', 'delivery_issue', 'order_error', 'product_question', 'refund', 'other');--> statement-breakpoint
CREATE TABLE "customer_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"subject" "message_subject" NOT NULL,
	"body" text NOT NULL,
	"order_id" text,
	"status" "message_status" DEFAULT 'untreated' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pinned_at" timestamp with time zone,
	"important" boolean DEFAULT false NOT NULL,
	"handled_at" timestamp with time zone,
	"handled_by_name" text,
	"search_text" text GENERATED ALWAYS AS (fig_normalize(body)) STORED NOT NULL,
	CONSTRAINT "customer_messages_handled_consistent" CHECK (("customer_messages"."handled_at" IS NULL) = ("customer_messages"."handled_by_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"position" integer NOT NULL,
	"file_name" text NOT NULL,
	"content_type" "attachment_content_type" NOT NULL,
	"size_bytes" integer NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "message_attachments_position_range" CHECK ("message_attachments"."position" >= 0 AND "message_attachments"."position" < 10),
	CONSTRAINT "message_attachments_size_positive" CHECK ("message_attachments"."size_bytes" > 0),
	CONSTRAINT "message_attachments_url_https" CHECK ("message_attachments"."url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_customer_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."customer_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_messages_received_idx" ON "customer_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "customer_messages_customer_idx" ON "customer_messages" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_messages_status_idx" ON "customer_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customer_messages_order_idx" ON "customer_messages" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_attachments_position_idx" ON "message_attachments" USING btree ("message_id","position");