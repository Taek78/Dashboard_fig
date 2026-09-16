-- 0009 : fidélité cumulée et catégorie, frais de livraison, créneaux d'une heure,
-- adresse de livraison, autorisations et parrainage des clients, remise de communauté
-- déduite du nombre de membres, file de notifications (décisions du client, 2026-09-16).
-- Opérations destructrices : la colonne communities.discount_percent est supprimée
-- (le taux se calcule désormais) et la fin des créneaux existants est réécrite à
-- début + une heure avant de poser la contrainte orders_slot_one_hour.
CREATE TYPE "public"."notification_kind" AS ENUM('order_status');--> statement-breakpoint
CREATE TABLE "customer_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"kind" "notification_kind" DEFAULT 'order_status' NOT NULL,
	"order_status" "order_status" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "address_line" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notify_offers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "notify_order_status" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "marketing_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "consents_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referral_code" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "referred_by_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_address_line" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_fee_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_notifications_order_idx" ON "customer_notifications" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "customer_notifications_customer_idx" ON "customer_notifications" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_notifications_pending_idx" ON "customer_notifications" USING btree ("created_at") WHERE "customer_notifications"."sent_at" is null;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_referred_by_id_customers_id_fk" FOREIGN KEY ("referred_by_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_referral_code_idx" ON "customers" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "customers_referred_by_idx" ON "customers" USING btree ("referred_by_id");--> statement-breakpoint
ALTER TABLE "communities" DROP COLUMN "discount_percent";--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_referral_code_format" CHECK ("customers"."referral_code" ~ '^[^#]+#[0-9]{4}$');--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_not_own_referrer" CHECK ("customers"."referred_by_id" <> "customers"."id");--> statement-breakpoint
-- Créneaux existants ramenés à une heure : la fin devient le début plus une heure.
UPDATE "orders" SET "delivery_end" = lpad((substr("delivery_start", 1, 2)::int + 1)::text, 2, '0') || ':00';--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_one_hour" CHECK ("orders"."delivery_start" ~ '^([01][0-9]|2[0-2]):00$' AND "orders"."delivery_end" = lpad((substr("orders"."delivery_start", 1, 2)::int + 1)::text, 2, '0') || ':00');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fee_non_negative" CHECK ("orders"."delivery_fee_cents" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_community_delivery_free" CHECK ("orders"."community_id" IS NULL OR "orders"."delivery_fee_cents" = 0);