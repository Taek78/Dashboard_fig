-- Paramètres du catalogue (décision du client, 2026-09-16) : une seule ligne,
-- id = 'catalog' (contrainte). sell_when_out_of_stock = un produit à stock 0
-- reste en vente ; sinon il est « en rupture de stock ». Non destructif : la
-- ligne est créée avec la valeur par défaut (non).
CREATE TABLE "catalog_settings" (
	"id" text PRIMARY KEY DEFAULT 'catalog' NOT NULL,
	"sell_when_out_of_stock" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_settings_single_row" CHECK ("catalog_settings"."id" = 'catalog')
);
--> statement-breakpoint
INSERT INTO "catalog_settings" ("id") VALUES ('catalog');
