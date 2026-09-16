-- Communautés et créneaux (décisions du client, 2026-09-16).
--
-- 1. Trois types de communauté remplacent les cinq anciens : voisinage,
--    entreprise, point relais. DESTRUCTIF pour la nuance : « crèche », « école »,
--    « association » et « autre » deviennent « voisinage » (seule « entreprise »
--    garde sa valeur). Données factices seulement sur nos bases locale et de test ;
--    l'application FIG, une fois branchée, pose le bon type.
-- 2. Visibilité publique ou privée, posée par l'application. Les lignes
--    existantes reçoivent « private » (le choix le plus prudent), puis la valeur
--    par défaut est retirée : toute nouvelle communauté doit en choisir une.
-- 3. Créneaux entre 10:00 et 20:00 (dernier créneau 19:00 → 20:00). La
--    contrainte vérifie les commandes existantes : la migration ÉCHOUE si une
--    commande a un créneau hors de cette plage, plutôt que de le réécrire en
--    silence (une base de dev se reseede : npm run db:seed).
CREATE TYPE "public"."community_visibility" AS ENUM('public', 'private');--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
UPDATE "communities" SET "kind" = 'voisinage' WHERE "kind" <> 'entreprise';--> statement-breakpoint
DROP TYPE "public"."community_kind";--> statement-breakpoint
CREATE TYPE "public"."community_kind" AS ENUM('voisinage', 'entreprise', 'point_relais');--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "kind" SET DATA TYPE "public"."community_kind" USING "kind"::"public"."community_kind";--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "visibility" "community_visibility" NOT NULL DEFAULT 'private';--> statement-breakpoint
ALTER TABLE "communities" ALTER COLUMN "visibility" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_slot_hours" CHECK ("orders"."delivery_start" >= '10:00' AND "orders"."delivery_start" <= '19:00');
