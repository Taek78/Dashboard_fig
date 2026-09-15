ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE text;--> statement-breakpoint
-- La contrainte d'annulation compare status à une valeur de l'enum : retirée le temps
-- de la conversion, recréée à l'identique à la fin.
ALTER TABLE "orders" DROP CONSTRAINT "orders_cancellation_consistent";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'preparing'::text;--> statement-breakpoint
-- Données : plus de statut « en attente » (décision du client, 2026-09-15). Trois
-- états de parcours : en préparation → expédiée → livrée ; l'annulation reste
-- possible depuis « en préparation ». Colonnes en texte à ce stade.
-- 1. Le passage « en attente → en préparation » disparaît de l'historique : une
--    commande reçue est en préparation d'emblée.
DELETE FROM "order_events" WHERE "from_status" = 'pending' AND "to_status" = 'preparing';--> statement-breakpoint
-- 2. Une annulation depuis « en attente » devient une annulation depuis « en préparation ».
UPDATE "order_events" SET "from_status" = 'preparing' WHERE "from_status" = 'pending';--> statement-breakpoint
DELETE FROM "order_events" WHERE "to_status" = 'pending';--> statement-breakpoint
-- 3. Les commandes en attente sont en préparation.
UPDATE "orders" SET "status" = 'preparing' WHERE "status" = 'pending';--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('preparing', 'delivering', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "from_status" SET DATA TYPE "public"."order_status" USING "from_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "order_events" ALTER COLUMN "to_status" SET DATA TYPE "public"."order_status" USING "to_status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'preparing'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cancellation_consistent" CHECK (("orders"."status" = 'cancelled') = ("orders"."cancellation_reason" IS NOT NULL));
