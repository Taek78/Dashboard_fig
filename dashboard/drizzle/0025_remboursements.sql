CREATE TYPE "public"."refund_kind" AS ENUM('refund', 'credit');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_kind" "refund_kind";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_cents" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_consistent" CHECK (("orders"."refund_kind" IS NULL) = ("orders"."refund_cents" IS NULL) AND ("orders"."refund_kind" IS NULL) = ("orders"."refunded_at" IS NULL));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_cancelled" CHECK ("orders"."refund_kind" IS NULL OR "orders"."status" = 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_amount" CHECK ("orders"."refund_cents" IS NULL OR ("orders"."refund_cents" > 0 AND "orders"."refund_cents" <= "orders"."total_cents"));