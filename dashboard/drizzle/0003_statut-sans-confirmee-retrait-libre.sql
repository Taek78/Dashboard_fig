ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
-- La contrainte d'annulation compare status à une valeur de l'enum : retirée le temps
-- de la conversion, recréée à l'identique à la fin.
ALTER TABLE "orders" DROP CONSTRAINT "orders_cancellation_consistent";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
-- Données : plus de statut « confirmée » (décision du client, 2026-09-15). Les
-- colonnes sont en texte à ce stade ; tout est converti avant de recréer l'enum.
-- 1. Une commande restée « confirmée » : son dernier passage devient
--    « en attente → en préparation ».
UPDATE "order_events" AS e SET "to_status" = 'preparing' WHERE e."to_status" = 'confirmed' AND NOT EXISTS (SELECT 1 FROM "order_events" AS n WHERE n."order_id" = e."order_id" AND n."from_status" = 'confirmed');--> statement-breakpoint
-- 2. Pour les autres, l'étape « confirmée » disparaît de l'historique.
DELETE FROM "order_events" WHERE "to_status" = 'confirmed';--> statement-breakpoint
UPDATE "order_events" SET "from_status" = 'pending' WHERE "from_status" = 'confirmed';--> statement-breakpoint
-- 3. Les commandes confirmées sont en préparation.
UPDATE "orders" SET "status" = 'preparing' WHERE "status" = 'confirmed';--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'preparing', 'delivering', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."order_status" USING "from_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."order_status" USING "to_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancellation_consistent" CHECK (("orders"."status" = 'cancelled') = ("orders"."cancellation_reason" IS NOT NULL));--> statement-breakpoint
-- L'horaire de retrait est choisi à chaque commande dans l'application (Order.deliverySlot) :
-- la colonne est supprimée, ses valeurs sont perdues (horaires indicatifs, jamais lus ailleurs).
ALTER TABLE "communities" DROP COLUMN "pickup_time";