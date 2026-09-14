CREATE TYPE "public"."article_category" AS ENUM('nutrition', 'recipe', 'science', 'news');--> statement-breakpoint
CREATE TYPE "public"."cancellation_reason" AS ENUM('stock', 'delivery', 'other');--> statement-breakpoint
CREATE TYPE "public"."container" AS ENUM('none', 'tray', 'parcel', 'crate', 'bag');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'delivering', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('fruit', 'vegetable');--> statement-breakpoint
CREATE TYPE "public"."product_unit" AS ENUM('piece', 'g');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'gestionnaire', 'lecture', 'livreur');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"category" "article_category" NOT NULL,
	"illustration" text NOT NULL,
	"image_url" text,
	"published_at" date NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"text" text NOT NULL,
	"author_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement_monthly" (
	"month" text PRIMARY KEY NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"signups" integer DEFAULT 0 NOT NULL,
	"complaints" integer DEFAULT 0 NOT NULL,
	"rating" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "engagement_month_format" CHECK ("engagement_monthly"."month" ~ '^[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"from_status" "order_status" NOT NULL,
	"to_status" "order_status" NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"cancellation_reason" "cancellation_reason",
	"cancellation_detail" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"order_id" text NOT NULL,
	"position" integer NOT NULL,
	"product_id" text NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit" "product_unit" NOT NULL,
	"line_total_cents" integer NOT NULL,
	CONSTRAINT "order_lines_order_id_position_pk" PRIMARY KEY("order_id","position"),
	CONSTRAINT "order_lines_quantity_positive" CHECK ("order_lines"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"customer_id" text NOT NULL,
	"delivery_date" date NOT NULL,
	"delivery_start" text NOT NULL,
	"delivery_end" text NOT NULL,
	"delivery_city" text NOT NULL,
	"delivery_postal_code" text NOT NULL,
	"total_cents" integer NOT NULL,
	"cancellation_reason" "cancellation_reason",
	"cancellation_detail" text,
	CONSTRAINT "orders_slot_format" CHECK ("orders"."delivery_start" ~ '^[0-9]{2}:[0-9]{2}$' AND "orders"."delivery_end" ~ '^[0-9]{2}:[0-9]{2}$'),
	CONSTRAINT "orders_cancellation_consistent" CHECK (("orders"."status" = 'cancelled') = ("orders"."cancellation_reason" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"variety" text,
	"category" "product_category" NOT NULL,
	"unit" "product_unit" NOT NULL,
	"price_cents" integer NOT NULL,
	"unit_weight_grams" integer,
	"container" "container" DEFAULT 'none' NOT NULL,
	"origin_country" text DEFAULT 'FR' NOT NULL,
	"origin_region" text,
	"caliber_min_mm" integer,
	"caliber_max_mm" integer,
	"organic" boolean DEFAULT false NOT NULL,
	"in_season" boolean DEFAULT false NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"illustration" text NOT NULL,
	"image_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_positive" CHECK ("products"."price_cents" > 0),
	CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock_quantity" >= 0),
	CONSTRAINT "products_caliber_both_or_none" CHECK (("products"."caliber_min_mm" IS NULL) = ("products"."caliber_max_mm" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_published_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "customer_notes_customer_idx" ON "customer_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_lower_idx" ON "customers" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_reference_idx" ON "orders" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "orders_delivery_date_idx" ON "orders" USING btree ("delivery_date");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));