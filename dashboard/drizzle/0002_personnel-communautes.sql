CREATE TYPE "public"."community_kind" AS ENUM('creche', 'ecole', 'entreprise', 'association', 'autre');--> statement-breakpoint
CREATE TYPE "public"."discount_kind" AS ENUM('community', 'loyalty');--> statement-breakpoint
CREATE TYPE "public"."staff_availability" AS ENUM('disponible', 'indisponible', 'conge');--> statement-breakpoint
CREATE TYPE "public"."staff_kind" AS ENUM('livreur', 'preparateur', 'gestionnaire');--> statement-breakpoint
CREATE TYPE "public"."staff_shift" AS ENUM('matin', 'apres_midi', 'soir', 'journee');--> statement-breakpoint
CREATE TABLE "communities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "community_kind" NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"pickup_place" text NOT NULL,
	"pickup_city" text NOT NULL,
	"pickup_postal_code" text NOT NULL,
	"pickup_time" text NOT NULL,
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "staff_kind" NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"shift" "staff_shift" NOT NULL,
	"availability" "staff_availability" NOT NULL,
	"work_days" text[] NOT NULL,
	"started_at" date NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "community_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "community_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_kind" "discount_kind";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_percent" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "preparer_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "driver_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_lower_idx" ON "staff" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "staff_kind_idx" ON "staff" USING btree ("kind");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_preparer_id_staff_id_fk" FOREIGN KEY ("preparer_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_driver_id_staff_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customers_community_idx" ON "customers" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "orders_community_idx" ON "orders" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "orders_preparer_idx" ON "orders" USING btree ("preparer_id");--> statement-breakpoint
CREATE INDEX "orders_driver_idx" ON "orders" USING btree ("driver_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_discount_consistent" CHECK (("orders"."discount_kind" IS NULL) = ("orders"."discount_percent" IS NULL) AND "orders"."discount_cents" >= 0);